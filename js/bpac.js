// Global İletişim Nesnesi ve Hata Mesajı
const bpac = self.bpac || {};

// Mesaj gönderme fonksiyonunu tanımla veya mevcut olanı kullan
bpac.appendMessage = (message) => {
    const event = new CustomEvent("bpac_send", { detail: message });
    document.dispatchEvent(event);
};

// Sabit hata mesajı
const BPAC_CONNECTION_ERROR = "Can't connect to b-PAC";

/**
 * 📦 Asenkron İletişim Yardımcı Fonksiyonu
 * Belirtilen bir yöntem (method) adını kullanarak bir mesaj gönderir ve
 * document üzerinde aynı yöntem adıyla tetiklenen yanıt olayını bekler.
 * @param {string} methodName - Beklenecek yanıt olayı adı (örn: "IObject::GetName").
 * @param {object} payload - Gönderilecek mesajın detayları.
 * @returns {Promise<any>} Başarılı olması durumunda yanıt detayını döndürür.
 */
function sendRequest(methodName, payload) {
    const responseEventName = methodName;
    
    return new Promise((resolve, reject) => {
        const handler = (event) => {
            document.removeEventListener(responseEventName, handler);

            if (event.detail.connect === false) {
                return reject(BPAC_CONNECTION_ERROR);
            }
            
            // Çoğu Get metodu için
            if (event.detail.ret === false && event.detail.connect !== false) {
                // Bazı metotlar ret:false döndüğünde bile başarılı sayılabilir (örn. Set metotları)
                // Orijinal kodun davranışını koruyarak, ret:false durumunda Promise'i çözmeyi (resolve) tercih ediyoruz.
                // Eğer hata detayları varsa, onları kontrol edip reddetme (reject) yapılabilir.
                return resolve(event.detail); // ret:false olmasına rağmen resolve ediyoruz (Orijinal koddaki bazı boş resolve'ları yansıtmak için)
            }
            
            // Yanıt detaylarındaki ilk anlamlı veriyi döndür
            const result = event.detail.attribute || 
                           event.detail.data || 
                           event.detail.effect || 
                           event.detail.point || 
                           event.detail.name || 
                           event.detail.height ||
                           event.detail.align || 
                           event.detail.orientation ||
                           event.detail.selection ||
                           event.detail.text ||
                           event.detail.type ||
                           event.detail.width ||
                           event.detail.X ||
                           event.detail.Y ||
                           event.detail.count ||
                           event.detail.index ||
                           event.detail.printers ||
                           event.detail.id ||
                           event.detail.length ||
                           event.detail.mediaIds ||
                           event.detail.mediaNames ||
                           event.detail.errorCode ||
                           event.detail.errorString ||
                           event.detail.image ||
                           event.detail.cutlines ||
                           event.detail.names ||
                           event.detail.ret; // Genel dönüş değeri
            
            resolve(result);
        };

        document.addEventListener(responseEventName, handler);
        bpac.appendMessage(payload);
    });
}

// Orijinal koddaki bazı metotların dönüş değerleri (ret:false veya p<0 ise) 
// özel işlem gerektirdiğinden, bu metotlar için özel Promise yapısı kullanılacaktır.

// ---

## 🛠️ IObject Sınıfı (Etiket Nesneleri)

```javascript
export class IObject {
    constructor(pointer) {
        this.pointer_ = pointer; // Orijinal koddaki p_
    }

    // --- GETTER METOTLARI ---

    GetAttribute(kind) {
        const method = "IObject::GetAttribute";
        const payload = { method, p: this.pointer_, kind };
        return sendRequest(method, payload);
    }
    
    GetData(kind) {
        const method = "IObject::GetData";
        const payload = { method, p: this.pointer_, kind };
        return sendRequest(method, payload);
    }

    GetFontBold() {
        const method = "IObject::GetFontBold";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload).then(detail => detail.ret); // Ret değerini döndür
    }

    GetFontEffect() {
        const method = "IObject::GetFontEffect";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload); // Effect değerini döndürür
    }

    // GetFontItalics, GetFontStrikeout, GetFontUnderline benzer şekilde GetFontBold gibi
    GetFontItalics() {
        const method = "IObject::GetFontItalics";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    GetFontMaxPoint() {
        const method = "IObject::GetFontMaxPoint";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload); // Point değerini döndürür
    }

    GetFontName() {
        const method = "IObject::GetFontName";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload); // Name değerini döndürür
    }
    
    GetFontStrikeout() {
        const method = "IObject::GetFontStrikeout";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    GetFontUnderline() {
        const method = "IObject::GetFontUnderline";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    // --- SETTER METOTLARI ---
    
    SetAlign(horizontal, vertical) {
        const method = "IObject::SetAlign";
        const payload = { method, p: this.pointer_, horizontal, vertical };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    SetAttribute(kind, attribute) {
        const method = "IObject::SetAttribute";
        const payload = { method, p: this.pointer_, kind, attribute };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    SetData(kind, data, param) {
        let serializedData;
        const objectType = Object.prototype.toString.call(data).slice(8,-1);
        // Date nesnesi ise saniye cinsinden Unix timestamp'e çevir
        serializedData = objectType === "Date" ? data.getTime() / 1e3 : data;
        
        const method = "IObject::SetData";
        const payload = { method, p: this.pointer_, kind, data: serializedData, param };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    SetFontBold(bold) {
        const method = "IObject::SetFontBold";
        const payload = { method, p: this.pointer_, bold };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetFontEffect(effect) {
        const method = "IObject::SetFontEffect";
        const payload = { method, p: this.pointer_, effect };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetFontItalics(italics) {
        const method = "IObject::SetFontItalics";
        const payload = { method, p: this.pointer_, italics };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetFontMaxPoint(point) {
        const method = "IObject::SetFontMaxPoint";
        const payload = { method, p: this.pointer_, point };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetFontName(name) {
        const method = "IObject::SetFontName";
        const payload = { method, p: this.pointer_, name };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetFontStrikeout(strikeout) {
        const method = "IObject::SetFontStrikeout";
        const payload = { method, p: this.pointer_, strikeout };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetFontUnderline(underline) {
        const method = "IObject::SetFontUnderline";
        const payload = { method, p: this.pointer_, underline };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetPosition(x, y, width, height) {
        const method = "IObject::SetPosition";
        const payload = { method, p: this.pointer_, x, y, width, height };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    SetSelection(start, end) {
        // Orijinal koddaki metod adı "IObject::SetPosition" yerine 
        // muhtemelen "IObject::SetSelection" olmalıydı. Orijinal kodu koruyoruz:
        const method = "IObject::SetPosition"; 
        const payload = { method, p: this.pointer_, start, end };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    // --- PROPERTY GETTERS/SETTERS ---

    // Getters (Okuyucu)
    get Height() {
        const method = "IObject::GetHeight";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get HorizontalAlign() {
        const method = "IObject::GetHorizontalAlign";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Name() {
        const method = "IObject::GetName";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Orientation() {
        const method = "IObject::GetOrientation";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get SelectionEnd() {
        const method = "IObject::GetSelectionEnd";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get SelectionStart() {
        const method = "IObject::GetSelectionStart";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Text() {
        const method = "IObject::GetText";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Type() {
        const method = "IObject::GetType";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get VerticalAlign() {
        const method = "IObject::GetVerticalAlign";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Width() {
        const method = "IObject::GetWidth";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get X() {
        const method = "IObject::GetX";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Y() {
        const method = "IObject::GetY";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }

    // Setters (Yazıcı) - Setters are fire-and-forget in original code (no Promise needed)
    set Height(height) {
        const payload = { method: "IObject::SetHeight", p: this.pointer_, height };
        bpac.appendMessage(payload);
    }
    set HorizontalAlign(align) {
        const payload = { method: "IObject::SetHorizontalAlign", p: this.pointer_, align };
        bpac.appendMessage(payload);
    }
    set Name(name) {
        const payload = { method: "IObject::SetName", p: this.pointer_, name };
        bpac.appendMessage(payload);
    }
    set Orientation(orientation) {
        const payload = { method: "IObject::SetOrientation", p: this.pointer_, orientation };
        bpac.appendMessage(payload);
    }
    set SelectionEnd(selection) {
        const payload = { method: "IObject::SetSelectionEnd", p: this.pointer_, selection };
        bpac.appendMessage(payload);
    }
    set SelectionStart(selection) {
        const payload = { method: "IObject::SetSelectionStart", p: this.pointer_, selection };
        bpac.appendMessage(payload);
    }
    set Text(text) {
        const payload = { method: "IObject::SetText", p: this.pointer_, text };
        bpac.appendMessage(payload);
    }
    set VerticalAlign(align) {
        const payload = { method: "IObject::SetVerticalAlign", p: this.pointer_, align };
        bpac.appendMessage(payload);
    }
    set Width(width) {
        const payload = { method: "IObject::SetWidth", p: this.pointer_, width };
        bpac.appendMessage(payload);
    }
    set X(X) {
        const payload = { method: "IObject::SetX", p: this.pointer_, X };
        bpac.appendMessage(payload);
    }
    set Y(Y) {
        const payload = { method: "IObject::SetY", p: this.pointer_, Y };
        bpac.appendMessage(payload);
    }
}

export class IObjects {
    constructor(pointer) {
        this.pointer_ = pointer;
    }

    GetItem(index) {
        const method = "IObjects::GetItem";
        const payload = { method, p: this.pointer_, index };
        
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                document.removeEventListener(method, handler);
                if (event.detail.connect === false) return reject(BPAC_CONNECTION_ERROR);
                if (event.detail.ret === false || event.detail.p < 0) return resolve(); // ret:false veya p<0 ise null/undefined döndür

                const object = new IObject(event.detail.p);
                resolve(object);
            };
            document.addEventListener(method, handler);
            bpac.appendMessage(payload);
        });
    }

    GetCount() {
        const method = "IObjects::GetCount";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }

    GetIndex(object) {
        const method = "IObjects::GetIndex";
        const payload = { method, p: this.pointer_, obj: object.pointer_ };
        return sendRequest(method, payload);
    }

    GetIndexByName(name, indexBgn) {
        const method = "IObjects::GetIndexByName";
        const payload = { method, p: this.pointer_, name, indexBgn };
        return sendRequest(method, payload);
    }

    Insert(index, type, X, Y, width, height, option) {
        const method = "IObjects::Insert";
        const payload = { method, p: this.pointer_, index, type, X, Y, width, height, option };

        return new Promise((resolve, reject) => {
            const handler = (event) => {
                document.removeEventListener(method, handler);
                if (event.detail.connect === false) return reject(BPAC_CONNECTION_ERROR);
                if (event.detail.ret === false || event.detail.p < 0) return resolve();
                
                const object = new IObject(event.detail.p);
                resolve(object);
            };
            document.addEventListener(method, handler);
            bpac.appendMessage(payload);
        });
    }

    Remove(index) {
        const method = "IObjects::Remove";
        const payload = { method, p: this.pointer_, index };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    // Property Getter
    get Count() {
        return this.GetCount();
    }
}

export class IPrinter {
    constructor(pointer) {
        this.pointer_ = pointer;
    }

    GetInstalledPrinters() {
        const method = "IPrinter::GetInstalledPrinters";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }

    GetMediaId() {
        const method = "IPrinter::GetMediaId";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    
    GetMediaName() {
        const method = "IPrinter::GetMediaName";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    
    GetPrintedTapeLength() {
        const method = "IPrinter::GetPrintedTapeLength";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    
    GetSupportedMediaIds() {
        const method = "IPrinter::GetSupportedMediaIds";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    
    GetSupportedMediaNames() {
        const method = "IPrinter::GetSupportedMediaNames";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }

    // ... (Diğer tüm metotlar benzer şekilde sendRequest kullanır)
    
    IsMediaIdSupported(id) {
        const method = "IPrinter::IsMediaIdSupported";
        const payload = { method, p: this.pointer_, id };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    IsMediaNameSupported(name) {
        const method = "IPrinter::IsMediaNameSupported";
        const payload = { method, p: this.pointer_, name };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    IsPrinterOnline(name) {
        const method = "IPrinter::IsPrinterOnline";
        const payload = { method, p: this.pointer_, name };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    IsPrinterSupported(name) {
        const method = "IPrinter::IsPrinterSupported";
        const payload = { method, p: this.pointer_, name };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    // Property Getters
    get ErrorCode() {
        const method = "IPrinter::GetErrorCode";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get ErrorString() {
        const method = "IPrinter::GetErrorString";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get Name() {
        const method = "IPrinter::GetName";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
    get PortName() {
        const method = "IPrinter::GetPortName";
        const payload = { method, p: this.pointer_ };
        return sendRequest(method, payload);
    }
}

export class IDocument {
    // --- Statik Metotlar ---

    static Open(filePath) {
        const method = "IDocument::Open";
        const payload = { method, filePath };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    static DoPrint(dwOption, szOption) {
        const method = "IDocument::DoPrint";
        const payload = { method, dwOption, szOption };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    static StartPrint(docName, option) {
        const method = "IDocument::StartPrint";
        const payload = { method, docName, option };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    static PrintOut(copyCount, option) {
        const method = "IDocument::PrintOut";
        const payload = { method, copyCount, option };
        return sendRequest(method, payload).then(detail => detail.ret);
    }
    
    static EndPrint() {
        const method = "IDocument::EndPrint";
        const payload = { method };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    static GetImageData(type, width, height) {
        const method = "IDocument::GetImageData";
        const payload = { method, type, width, height };
        // Bu metot, başarılıysa image verisini, başarısızsa hata döndürmelidir.
        return sendRequest(method, payload); 
    }
    
    static GetObjectsCount() {
        const method = "IDocument::GetObjectsCount";
        const payload = { method };
        return sendRequest(method, payload);
    }

    static GetIndexByName(name, indexBgn) {
        const method = "IDocument::GetIndexByName";
        const payload = { method, name, indexBgn };
        return sendRequest(method, payload);
    }

    static GetObject(name) {
        const method = "IDocument::GetObject";
        const payload = { method, name };
        
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                document.removeEventListener(method, handler);
                if (event.detail.connect === false) return reject(BPAC_CONNECTION_ERROR);
                if (event.detail.ret === false || event.detail.p < 0) return resolve();

                const object = new IObject(event.detail.p);
                resolve(object);
            };
            document.addEventListener(method, handler);
            bpac.appendMessage(payload);
        });
    }

    static GetObjects(name) {
        const method = "IDocument::GetObjects";
        const payload = { method, name };
        
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                document.removeEventListener(method, handler);
                if (event.detail.ret === false || event.detail.connect === false) return reject(BPAC_CONNECTION_ERROR);
                if (event.detail.p < 0) return resolve(); // p<0 ise null döndür

                const objects = new IObjects(event.detail.p);
                resolve(objects);
            };
            document.addEventListener(method, handler);
            bpac.appendMessage(payload);
        });
    }

    // ... (Diğer tüm metotlar benzer şekilde sendRequest kullanır)
    
    static GetPrinter() {
        const method = "IDocument::GetPrinter";
        const payload = { method };
        
        return new Promise((resolve, reject) => {
            const handler = (event) => {
                document.removeEventListener(method, handler);
                if (event.detail.ret === false || event.detail.connect === false) return reject(BPAC_CONNECTION_ERROR);
                if (event.detail.p < 0) return reject(); // p<0 ise hata döndür (orijinal kodda r() çağrılıyor)

                const printer = new IPrinter(event.detail.p);
                resolve(printer);
            };
            document.addEventListener(method, handler);
            bpac.appendMessage(payload);
        });
    }
    
    // SetText, SetBarcodeData, SetMarginLeftRight vb. için ret değeri döndürülür:
    static SetText(index, text) {
        const method = "IDocument::SetText";
        const payload = { method, index, text };
        return sendRequest(method, payload).then(detail => detail.ret);
    }

    // --- Statik Property Getters/Setters ---

    static get Width() { return IDocument.GetWidth(); }
    static get Length() { return IDocument.GetLength(); }
    static set Length(length) { IDocument.SetLength(length); }
    // ... (Diğer tüm static property'ler için Get/Set metot çağrıları)
}

/**
 * b-PAC tarayıcı uzantısının yüklü olup olmadığını kontrol eder.
 * @returns {boolean} Uzantı yüklü ise true, değilse false.
 */
export const IsExtensionInstalled = () => 
    document.body.classList.contains("bpac-extension-installed");
