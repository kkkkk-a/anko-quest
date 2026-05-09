// ==========================================
// 📚 AAライブラリ・統合管理マニフェスト（規約ベース版）
// ==========================================
// 【ルール】
// エディタで入力するAAの指定は、必ず以下の「4つの階層（ドット区切り）」になります。
// [カテゴリ] . [出典/ジャンル] . [ファイル名] . [AAのID（表情など）]
//
// 例: CHARACTER.ORIGINAL.YARUO.normal
//     → 自動的に aa_library/character/original/yaruo.js を読み込み、
//       その中の DATAオブジェクトから normal を探します。
// ==========================================

// ---------------------------------------------------------
// 1. エディタ用の「目次（ピッカー用リスト）」
// ※これはシステムがAAを探すためではなく、人間がエディタで選ぶためのリストです。
// ---------------------------------------------------------
// ---------------------------------------------------------
// 1. エディタ用の「目次（ピッカー用リスト）」
// ※これはシステムがAAを探すためではなく、人間がエディタで選ぶためのリストです。
// ---------------------------------------------------------
const AA_MAP = {
    // --- キャラクター ---
    "CHARACTER.ORIGINAL.YARUO":       { name: "やる夫" },
    "CHARACTER.ORIGINAL.YARANAIO":     { name: "やらない夫" },
    "CHARACTER.ORIGINAL.YARANAIKO":   { name: "やらない子" },
    "CHARACTER.ORIGINAL.DEKIRUO":      { name: "できる夫" },
    "CHARACTER.ORIGINAL.DEKINAIO":    { name: "できない夫" },
    "CHARACTER.ORIGINAL.DOKUO":       { name: "ドクオ" },
    "CHARACTER.ORIGINAL.KIRUO":       { name: "キル夫" },
    "CHARACTER.ORIGINAL.AKUMAYARUO": { name: "悪魔やる夫" },
      "CHARACTER.ORIGINAL.NERAUO":      { name: "ねらう緒" },
            "CHARACTER.ORIGINAL.YARUMI":      { name: "やる実" },
            "CHARACTER.ORIGINAL.KAKURENA":       { name: "隠れ奈" },
"CHARACTER.ORIGINAL.SLIME":       { name: "スライム" },
    "CHARACTER.ORIGINAL.GOBLIN":      { name: "ゴブリン" },
    // --- アイテム・UI（その他のカテゴリ） ---
    "ITEM.ORIGINAL.BASIC":            { name: "汎用アイテム" },
    "LAYOUT.ORIGINAL.BASIC":             { name: "枠" },
        "STAGE.AAhub.RIVER":             { name: "河川" },
        "EFFECT.ORIGINAL.BASIC":             { name: "集中線" }
};

// ---------------------------------------------------------
// 2. 読み込み済みのデータを保持するキャッシュ（超高速化用）
// ---------------------------------------------------------
const AA_CACHE = {};

window.resolveAA = async function(path) {
    if (!path) return "";

    // 🌟 修正：データが表情付きの「箱（JSON形式の文字列）」だった場合、中身を解凍する
    let targetPath = path;
    if (typeof targetPath === "string" && targetPath.trim().startsWith("{")) {
        try {
            const aaObj = JSON.parse(targetPath);
            // 「通常」の表情があれば優先、なければ一番最初のデータを使う
            targetPath = aaObj["通常"] || Object.values(aaObj)[0] || "";
        } catch (e) {
            // JSONパースに失敗した場合はそのままの文字列として扱う
        }
    }

    // もしデータが（文字列ではなく）最初からオブジェクトとして届いた場合への対応
    if (typeof targetPath === "object" && targetPath !== null) {
        targetPath = targetPath["通常"] || Object.values(targetPath)[0] || "";
    }

    // 🌟 1. 暗号化（Base64）されている場合の解読処理
    let decoded = targetPath;
    try {
        if (typeof targetPath === "string" && !targetPath.includes('.') && /^[A-Za-z0-9+/=]+$/.test(targetPath) && targetPath.length > 20) {
            decoded = decodeURIComponent(atob(targetPath));
        }
    } catch (e) {
        decoded = targetPath; 
    }

    // 🌟 2. 直書き判定
    if (decoded.includes('\n') || decoded.length > 100 || !decoded.includes('.')) {
        return decoded;
    }

    // 🌟 3. ドット区切りのパス解析
    const parts = decoded.toLowerCase().split('.');

    // 旧来の静的オブジェクト（AA変数）チェック
    if (typeof AA !== 'undefined') {
        let obj = AA; 
        let found = true;
        for (let i = 0; i < parts.length; i++) {
            if (!obj) { found = false; break; }
            const key = Object.keys(obj).find(k => k.toLowerCase() === parts[i]);
            if (!key) { found = false; break; }
            obj = obj[key];
        }
        if (found && typeof obj === "string") return obj;
    }

    // 🌟 4. 動的ロード
    if (parts.length >= 4) {
        const cacheKey = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const idParts = parts.slice(3);

        try {
            if (!AA_CACHE[cacheKey]) {
                const mltPath = `${parts[0]}/${parts[1]}/${parts[2]}.mlt`;
                const response = await fetch(`./aa_library/${mltPath}`);
                if (!response.ok) throw new Error("File not found");
                const textData = await response.text();

                const parsedData = {};
                let currentKey = null;
                let currentAA = [];
                const lines = textData.split(/\r?\n/);
                for (let line of lines) {
                    const match = line.match(/^\[AA:(.+?)\]$/);
                    if (match) {
                        if (currentKey) parsedData[currentKey] = currentAA.join('\n').replace(/\n+$/, '');
                        currentKey = match[1].trim(); 
                        currentAA = [];        
                    } else {
                        if (currentKey) currentAA.push(line); 
                    }
                }
                if (currentKey) parsedData[currentKey] = currentAA.join('\n').replace(/\n+$/, ''); 
                AA_CACHE[cacheKey] = parsedData;
            }

            let current = AA_CACHE[cacheKey];
            for (const id of idParts) {
                const key = Object.keys(current).find(k => k.toLowerCase() === id);
                if (!key) return decoded; 
                current = current[key];
            }
            if (typeof current === "string") return current;

        } catch (e) {
            return decoded;
        }
    }

    return decoded;
};