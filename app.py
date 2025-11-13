# app.py (GRID YAPISINI VE DİNAMİK/STATİK RENKLERİ DESTEKLEYEN SON VERSİYON)

import os
import pandas as pd
from flask import Flask, render_template, redirect, url_for, request, session, flash, send_file
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired
import json # JSON işlemleri için
import uuid # Rastgele ID'ler için
import qrcode # QR kod oluşturma için
from io import BytesIO # Dosya yükleme/indirme için
import urllib.parse # URL kodlama için
from functools import wraps # Decorator'lar için

ALLOWED_EXTENSIONS = {'csv', 'xlsx'}

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cok_gizli_ve_guvenli_bir_anahtar' 
app.config['UPLOAD_FOLDER'] = 'uploads' 

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# --- Form ve Yardımcı Fonksiyonlar ---

class LoginForm(FlaskForm):
    """Kullanıcı Giriş Formu"""
    username = StringField('Kullanıcı Adı', validators=[DataRequired()])
    password = PasswordField('Parola', validators=[DataRequired()])
    submit = SubmitField('Giriş Yap')

def allowed_file(filename):
    """Desteklenen dosya uzantısı kontrolü"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def login_required(f):
    """Giriş kontrol decorator'ı"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or not session['logged_in']:
            flash('Bu sayfayı görüntülemek için giriş yapmalısınız.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- QR Kod Rotası ---

@app.route('/qrcode/<path:data_to_encode>')
@login_required
def generate_qrcode(data_to_encode):
    """Verilen metni QR koda çevirip resim olarak döndürür."""
    # Güvenlik ve Türkçe karakter desteği için decode/unquote
    qr_data = urllib.parse.unquote(data_to_encode) 
    try:
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=4, border=4)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return send_file(buffer, mimetype='image/png')
    except Exception as e:
        # Hata durumunda boş 204 döner (resim yüklenmez)
        return "", 204 

# --- Rota Tanımlamaları ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        if form.username.data == 'admin' and form.password.data == 'admin':
            session['logged_in'] = True
            flash('Başarıyla giriş yaptınız!', 'success')
            return redirect(url_for('upload'))
        else:
            flash('Hatalı kullanıcı adı veya parola.', 'danger')
    return render_template('login.html', form=form)

@app.route('/logout')
def logout():
    session.clear() 
    flash('Çıkış yapıldı.', 'info')
    return redirect(url_for('login'))


@app.route('/', methods=['GET', 'POST'])
@login_required
def upload():
    """Dosya yükleme ve Parquet'e dönüştürme rotası"""
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('Dosya bulunamadı', 'danger')
            return redirect(request.url)
        
        file = request.files['file']
        if file.filename == '':
            flash('Dosya seçilmedi', 'danger')
            return redirect(request.url)
        
        if file and allowed_file(file.filename):
            filename = file.filename
            temp_filename = str(uuid.uuid4()) + "_" + filename 
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
            
            try:
                file.save(filepath)
                df = None
                
                # CSV/XLSX okuma denemeleri
                if filename.endswith('.csv'):
                    denemeler = [
                        ('utf-8', '\t'), ('cp1254', '\t'), ('latin1', '\t'),
                        ('utf-8', ','), ('latin1', ';'), ('cp1254', ';'),
                        ('utf-8', ';'), ('latin1', ','), ('cp1254', ','),
                    ]
                    MIN_EXPECTED_COLUMNS = 2 
                    for encoding, sep in denemeler:
                        try:
                            temp_df = pd.read_csv(filepath, encoding=encoding, sep=sep, dtype=str, keep_default_na=False)
                            if len(temp_df.columns) >= MIN_EXPECTED_COLUMNS:
                                df = temp_df
                                break
                        except Exception:
                            continue
                    
                    if df is None:
                        raise Exception("CSV okuma hatası: Geçerli bir kodlama veya ayırıcı bulunamadı.")
                else: 
                    df = pd.read_excel(filepath, dtype=str, keep_default_na=False)
                
                # Veriyi Parquet'e kaydetme
                data_uuid = str(uuid.uuid4())
                parquet_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{data_uuid}.parquet')
                df.to_parquet(parquet_path)

                # Session'ı güncelle
                session.clear()
                session['logged_in'] = True 
                session['data_uuid'] = data_uuid
                session['dataframe_columns'] = list(df.columns)
                
                os.remove(filepath)
                
                flash(f'Dosya "{filename}" başarıyla yüklendi ({len(df.columns)} sütun bulundu).', 'success')
                return redirect(url_for('table_view'))
                
            except Exception as e:
                if os.path.exists(filepath): os.remove(filepath)
                error_message = str(e)
                flash(f'Dosya okuma hatası: {error_message}', 'danger')
                return redirect(request.url)
        else:
            flash('Desteklenmeyen dosya formatı. Lütfen CSV veya XLSX yükleyin.', 'danger')
            return redirect(request.url)
            
    return render_template('upload.html')


@app.route('/table', methods=['GET', 'POST'])
@login_required
def table_view():
    """Veri tablosunu gösterir ve yazdırma için satır seçimi yapar."""
    if 'data_uuid' not in session:
        flash('Lütfen önce bir dosya yükleyin.', 'warning')
        return redirect(url_for('upload'))

    data_uuid = session['data_uuid']
    parquet_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{data_uuid}.parquet')
    
    try:
        df = pd.read_parquet(parquet_path)
    except FileNotFoundError:
        flash('Veri dosyası bulunamadı. Lütfen tekrar yükleyin.', 'danger')
        return redirect(url_for('upload'))
    
    template_set = 'label_template_rows' in session and session.get('label_template_rows') is not None and len(session.get('label_template_rows')) > 0
    
    if request.method == 'POST':
        if not template_set:
            flash('Lütfen yazdırma işlemine geçmeden önce Etiket Şablonunu ayarlayın.', 'warning')
            return redirect(url_for('template_design'))
            
        selected_rows_indices = request.form.getlist('selected_rows')
        if not selected_rows_indices:
            flash('Yazdırmak için en az bir satır seçmelisiniz.', 'warning')
            return redirect(url_for('table_view'))
            
        selected_df = df.iloc[[int(i) for i in selected_rows_indices]]
        
        print_uuid = str(uuid.uuid4())
        print_parquet_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{print_uuid}_print.parquet')
        selected_df.to_parquet(print_parquet_path)
        
        session['print_uuid'] = print_uuid
        
        flash(f'{len(selected_rows_indices)} adet satır yazdırmaya hazır. Önizleme sayfasına yönlendiriliyorsunuz.', 'info')
        return redirect(url_for('print_preview'))

    return render_template('table_view.html', 
                           columns=df.columns.tolist(), 
                           data=df.values.tolist(),
                           data_json=df.to_json(orient='records'),
                           template_set=template_set)


@app.route('/template_design', methods=['GET', 'POST'])
@login_required
def template_design():
    """Etiket Şablonu Tasarım Sayfası (GRID ve Hücre Birleştirmeyi Kullanır)"""
    if 'dataframe_columns' not in session:
        flash('Lütfen önce bir dosya yükleyin.', 'warning')
        return redirect(url_for('upload'))
        
    data_columns = session.get('dataframe_columns', [])
    current_template_rows = session.get('label_template_rows', [])

    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'add_cell': 
            item_type = request.form.get('item_type')
            
            # Ortak Ayarlar
            try:
                col_span = int(request.form.get('col_span', 1))
                row_span = int(request.form.get('row_span', 1))
            except ValueError:
                flash("Hata: Sütun/Satır birleştirme değerleri sayı olmalıdır.", 'danger')
                return redirect(url_for('template_design'))

            height_val = request.form.get('height_val', '40px')
            font_size = request.form.get('font_size', '12px')
            
            # Stil Ayarları
            bold = request.form.get('bold') == 'on'
            italic = request.form.get('italic') == 'on'
            
            # Dinamik Renk Sütunları
            bgcolor_col = request.form.get('bgcolor_col', '')
            textcolor_col = request.form.get('textcolor_col', '')
            
            # Statik Renk Kodları (Yeni Ekleme)
            static_bgcolor = request.form.get('static_bgcolor', '').strip()
            static_textcolor = request.form.get('static_textcolor', '').strip()

            item = {
                'type': item_type,
                'col_span': min(col_span, 6), 
                'row_span': row_span,
                'height_val': height_val,
                'size': font_size,
                'bold': bold,
                'italic': italic,
                # Renk Ayarları
                'bgcolor_col': bgcolor_col if bgcolor_col in data_columns else '',
                'textcolor_col': textcolor_col if textcolor_col in data_columns else '',
                'static_bgcolor': static_bgcolor,
                'static_textcolor': static_textcolor,
                'name': '', 
                'content': '' 
            }
            
            # İçerik Yönetimi
            if item_type == 'static_text':
                item['content'] = request.form.get('static_text_content', 'Sabit Metin')
            elif item_type in ('text', 'barcode_text', 'qrcode'):
                col_name = request.form.get('dynamic_col_name')
                if col_name in data_columns:
                    item['name'] = col_name
                else:
                    flash(f"Hata: Dinamik alan için geçerli bir sütun adı seçilmedi: {col_name}", 'danger')
                    return redirect(url_for('template_design'))
            elif item_type == 'image_logo':
                item['name'] = request.form.get('image_logo_url', '/static/logo.png')
            
            current_template_rows.append(item)
            session['label_template_rows'] = current_template_rows
            flash("Yeni hücre şablona eklendi.", 'success')
            return redirect(url_for('template_design'))

        elif action == 'clear_template':
            session.pop('label_template_rows', None)
            flash("Şablon başarıyla temizlendi.", 'info')
            return redirect(url_for('template_design'))
        
        elif action == 'save_and_return':
            if not current_template_rows:
                flash("Şablon oluşturulmadan veri tablosuna geri dönüldü.", 'warning')
            else:
                flash("Şablon kaydedildi. Şimdi yazdırmak istediğiniz satırları seçebilirsiniz.", 'success')
            return redirect(url_for('table_view'))
        
        elif action == 'export_template':
             if not current_template_rows:
                 flash("Dışa aktarılacak şablon bulunamadı.", 'warning')
                 return redirect(url_for('template_design'))
             template_data = {'columns': data_columns, 'template': current_template_rows}
             buffer = BytesIO()
             buffer.write(json.dumps(template_data, ensure_ascii=False, indent=4).encode('utf-8'))
             buffer.seek(0)
             return send_file(buffer, mimetype='application/json', as_attachment=True, download_name='etiket_sablonu.json')

        elif action == 'import_template':
            if 'template_file' not in request.files or request.files['template_file'].filename == '' or not request.files['template_file'].filename.endswith('.json'):
                flash('Lütfen geçerli bir JSON şablon dosyası seçin.', 'danger')
                return redirect(url_for('template_design'))
            try:
                file = request.files['template_file']
                template_data = json.loads(file.read().decode('utf-8'))
                new_template_rows = template_data.get('template', [])
                if not new_template_rows:
                    flash('İçe aktarılan JSON dosyası geçerli bir şablon içermiyor.', 'danger')
                    return redirect(url_for('template_design'))
                session['label_template_rows'] = new_template_rows
                flash('Şablon başarıyla içe aktarıldı.', 'success')
                return redirect(url_for('template_design'))
            except Exception as e:
                flash(f'İçe aktarma sırasında bir hata oluştu: {e}', 'danger')
                return redirect(url_for('template_design'))
        
        elif action == 'move_up' or action == 'move_down':
            row_index = int(request.form.get('row_index'))
            if action == 'move_up' and row_index > 0:
                current_template_rows[row_index], current_template_rows[row_index - 1] = current_template_rows[row_index - 1], current_template_rows[row_index]
            elif action == 'move_down' and row_index < len(current_template_rows) - 1:
                current_template_rows[row_index], current_template_rows[row_index + 1] = current_template_rows[row_index + 1], current_template_rows[row_index]
            session['label_template_rows'] = current_template_rows
            flash("Hücre sırası güncellendi.", 'info')
            return redirect(url_for('template_design'))
        
        elif action == 'delete_row': 
            row_index = int(request.form.get('row_index'))
            if 0 <= row_index < len(current_template_rows):
                current_template_rows.pop(row_index)
                session['label_template_rows'] = current_template_rows
                flash("Hücre şablondan silindi.", 'danger')
            return redirect(url_for('template_design'))


    return render_template('template_design.html', 
                           data_columns=data_columns,
                           current_template_rows=current_template_rows)

# --- bPac Rotası ---
@app.route('/bpac_label', methods=['GET'])
@login_required
def bpac_label():
    """Brother b-PAC Etiket Yazdırma Sayfası"""
    # print_uuid kontrolü: yazdırılacak veri var mı
    if 'print_uuid' not in session:
        flash('Yazdırılacak veri bulunamadı. Lütfen önce tablo üzerinden satır seçin.', 'warning')
        return redirect(url_for('table_view'))

    print_uuid = session['print_uuid']
    parquet_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{print_uuid}_print.parquet')
    
    if not os.path.exists(parquet_path):
        flash('Yazdırılacak veri dosyası bulunamadı.', 'danger')
        return redirect(url_for('table_view'))
    
    df = pd.read_parquet(parquet_path)
    columns = df.columns.tolist()
    data_json = df.to_json(orient='records', force_ascii=False)
    
    return render_template('bpac_label.html', columns=columns, data_json=data_json)


@app.route('/print_preview')
@login_required
def print_preview():
    """Yazdırma Önizleme Sayfası (GRID ve Dinamik Stil Kullanır)"""
    if 'print_uuid' not in session:
        flash('Yazdırılacak veri bulunamadı.', 'warning')
        return redirect(url_for('table_view'))
        
    print_uuid = session['print_uuid']
    print_parquet_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{print_uuid}_print.parquet')
    
    try:
        print_df = pd.read_parquet(print_parquet_path)
    except FileNotFoundError:
        flash('Yazdırma için seçilen veri dosyası bulunamadı.', 'danger')
        return redirect(url_for('table_view'))

    # Şablonu al (Düz hücre listesi)
    template_rows = session.get('label_template_rows', [])
    if not template_rows:
        flash('Yazdırılacak şablon bulunamadı. Lütfen önce şablonu ayarlayın.', 'danger')
        return redirect(url_for('template_design'))

    labels = []
    
    for index, row in print_df.iterrows():
        label_content = f"""
        <div class="etiket-kutu">
            <div class="etiket-grid">
        """
        
        for item in template_rows:
            item_type = item.get('type')
            col_span = item.get('col_span', 1)
            row_span = item.get('row_span', 1)
            height_val = item.get('height_val', '40px')
            font_size = item.get('size', '12px')
            
            # Stil Ayarlarını Al
            bold_style = 'font-weight: bold;' if item.get('bold') else ''
            italic_style = 'font-style: italic;' if item.get('italic') else ''
            
            # *** RENK YÖNETİMİ ***
            # 1. Arkaplan Rengi (Dinamik > Statik > Varsayılan)
            bgcolor_col = item.get('bgcolor_col')
            bg_color_value = row.get(bgcolor_col, None) if bgcolor_col else None
            static_bgcolor = item.get('static_bgcolor', '')
            
            bg_color = bg_color_value if bg_color_value else (static_bgcolor if static_bgcolor else 'transparent')
            # Güvenlik kontrolü
            bg_color = bg_color if bg_color.startswith('#') or bg_color.lower() in ['red', 'blue', 'yellow', 'green', 'transparent', 'white', 'black'] else 'transparent'


            # 2. Yazı Rengi (Dinamik > Statik > Varsayılan)
            textcolor_col = item.get('textcolor_col')
            text_color_value = row.get(textcolor_col, None) if textcolor_col else None
            static_textcolor = item.get('static_textcolor', '')
            
            text_color = text_color_value if text_color_value else (static_textcolor if static_textcolor else '#000')
            # Güvenlik kontrolü
            text_color = text_color if text_color.startswith('#') or text_color.lower() in ['red', 'blue', 'yellow', 'green', 'transparent', 'white', 'black'] else '#000'
            
            # CSS Grid için span değerlerini ayarla
            grid_style = f"grid-column: span {col_span}; grid-row: span {row_span}; min-height: {height_val};"
            
            # Hücre stili
            cell_style = f"background-color: {bg_color}; color: {text_color}; {bold_style} {italic_style}"
            
            # Etiket Hücresi
            label_content += f'<div class="label-cell" style="{grid_style} {cell_style}">'

            # --- İçerik Oluşturma ---
            
            common_text_style = f'margin: 0; padding: 0; word-break: break-all; white-space: normal; line-height: 1.2; font-size: {font_size};'
            
            if item_type == 'static_text':
                content = item.get('content', '')
                label_content += f'<div style="text-align: center; {common_text_style}">{content}</div>'
            
            elif item_type == 'image_logo':
                url = item.get('name', '')
                label_content += f'<div style="text-align: center;"><img src="{url}" alt="Logo" style="max-height: 100%; width: auto; max-width: 100%; display: inline-block;"></div>'
            
            elif item_type == 'qrcode':
                column_name = item.get('name')
                data_value = str(row.get(column_name, 'VERİ YOK')) 
                encoded_data = urllib.parse.quote(data_value, safe='')
                qr_code_url = url_for('generate_qrcode', data_to_encode=encoded_data)
                
                label_content += f'''
                    <div style="text-align: center; padding: 5px; height: 100%;">
                        <img src="{qr_code_url}" alt="QR Kod: {data_value}" style="max-height: 100%; width: auto; max-width: 100%; display: block; margin: 0 auto;">
                    </div>
                '''

            elif item_type in ('text', 'barcode_text'):
                column_name = item.get('name')
                data_value = str(row.get(column_name, 'VERİ YOK')) 
                
                text_align = 'left'
                if item_type == 'barcode_text':
                    text_align = 'center'
                    
                label_content += f'<div style="text-align: {text_align}; {common_text_style}">{data_value}</div>'
            
            label_content += '</div>' # label-cell kapat
        
        label_content += '</div>' # etiket-grid kapat
        label_content += '</div>' # etiket-kutu kapat
        labels.append(label_content)
    
    # print_preview.html şablonunu kullan
    return render_template('print_preview.html', labels=labels)


#    if __name__ == '__main__':
#
#       app.run(debug=True)


