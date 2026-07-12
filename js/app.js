/**
 * @file app.js
 * @description Application entry point. Loads the SQL.js library, initialises the
 *              database (from IndexedDB or fresh), sets up automatic persistence,
 *              and hands control to the UIManager to build the UI.
 * @author      Abbas Hatami Khoshmardan
 * @company     nouz.ir
 * @contact     khoshmard@gmail.com
 * @date        2025-07-12
 * @version     1.0.0
 */

(async function () {
    // --------------------------------------------------
    // Helper: IndexedDB persistence
    // --------------------------------------------------
    /**
     * Saves the binary database buffer to IndexedDB for persistent storage.
     * @param {ArrayBuffer} buffer - The serialised SQLite database.
     */
    function saveToIndexedDB(buffer) {
        const request = indexedDB.open('PensionDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('database')) {
                db.createObjectStore('database');
            }
        };
        request.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('database', 'readwrite');
            tx.objectStore('database').put(buffer, 'sqlite_db');
            tx.oncomplete = () => console.log('💾 Database persisted to IndexedDB');
            tx.onerror = () => console.warn('IndexedDB save failed');
        };
        request.onerror = (e) => console.warn('IndexedDB open failed', e.target.error);
    }

    /**
     * Loads the binary database buffer from IndexedDB.
     * @returns {Promise<ArrayBuffer|null>}
     */
    function loadFromIndexedDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('PensionDB', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('database')) {
                    db.createObjectStore('database');
                }
            };
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('database', 'readonly');
                const getReq = tx.objectStore('database').get('sqlite_db');
                getReq.onsuccess = () => resolve(getReq.result || null);
                getReq.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    }

    try {
        // --------------------------------------------------
        // 1. Initialise SQL.js
        // --------------------------------------------------
        const SQL = await initSqlJs({
            locateFile: file => `js/lib/${file}`  // address of sql-wasm.wasm
        });

        // --------------------------------------------------
        // 2. Load or create the database
        // --------------------------------------------------
        let db;
        const savedBuffer = await loadFromIndexedDB();
        if (savedBuffer) {
            db = new SQL.Database(new Uint8Array(savedBuffer));
            console.log('📂 Database loaded from IndexedDB');
        } else {
            db = new SQL.Database();
            console.log('🆕 New database created');
        }

        // --------------------------------------------------
        // 3. Hand the database to the data service layer
        // --------------------------------------------------
        DatabaseService.init(db);

        // --------------------------------------------------
        // 4. Set up global persistence trigger
        // --------------------------------------------------
        window._persist = () => {
            const data = db.export();
            saveToIndexedDB(data.buffer);
        };

        // Auto‑save every 30 seconds
        setInterval(() => window._persist(), 30000);

        // --------------------------------------------------
        // 5. Build the UI and start the application
        // --------------------------------------------------
        UIManager.init();

        console.log('🏛️ سامانه محاسبه حقوق بازنشستگان آماده به کار است');
    } catch (error) {
        console.error('❌ Application failed to start:', error);
        document.body.innerHTML = `
            <div style="padding:40px; text-align:center; font-family:sans-serif; direction:rtl;">
                <h2>خطا در راه‌اندازی برنامه</h2>
                <p>لطفاً مطمئن شوید که فایل‌های <code>sql-wasm.js</code> و <code>sql-wasm.wasm</code> در کنار برنامه قرار دارند و از یک سرور محلی (مثل Live Server) استفاده می‌کنید.</p>
            </div>`;
    }
})();