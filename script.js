const ATTR_KEYS = ["fire", "elec", "ice", "wind", "water", "earth", "bomb", "dark", "wave", "light", "mystic", "spirit", "gravity", "fight", "grass"];
const ATTR_NAMES = ["火炎", "電撃", "氷結", "疾風", "水流", "大地", "爆破", "暗黒", "波動", "白光", "神秘", "霊気", "重力", "格闘", "草花"];
const STATUS_NAMES = { none: "", poison: "猛毒", deadly_poison: "劇毒", rot: "腐敗", freeze: "凍結", frostbite: "凍傷", paralysis: "麻痺", burn: "火傷", blaze: "炎上", sleep: "睡眠", confusion: "混乱", bleed: "出血", harden: "硬化", drown: "溺水", charm: "魅了", seal: "封印", slow: "鈍足", fast: "俊足", focus: "集中", reverse: "反転", stone: "石化", provoke: "挑発", aging: "老化", protect: "守護", invincible: "無敵", stagnate: "停滞", aggressive: "好戦", exception: "例外", repetition: "反復", doom: "破滅", surehit: "必中", fragile: "脆弱", fortress: "堅牢", immovable: "不動", rage: "憤怒", flat: "均一", hp_curse: "呪詛", res_curse: "呪縛", dodge: "身躱" };
// 🌟 追加：重大な状態異常（破滅・無敵など）が毒などで上書きされるのを防ぐガード
window.isStatusOverwritable = function(currentStatus) {
    if (!currentStatus || currentStatus === "none") return true;
    if (currentStatus === "doom") return false; // 破滅は絶対上書き不可
    if (currentStatus === "protect" || currentStatus === "invincible") return false; // 守護・無敵も上書き不可
    return true;
};

window.resolveTacticalOverlap = function(char) {
    if (!state.tacData || !document.getElementById("view-tactical").classList.contains("active")) return;
    if (char.x === undefined || char.y === undefined || char.x === -1) return;

    let overlap =[...state.player.slice(0, state.battleMemberCount || 3), ...state.enemy].find(u => u !== char && u.hp > 0 && u.x === char.x && u.y === char.y);
    if (!overlap) return;

    let queue =[{x: char.x, y: char.y}];
    let visited = new Set([`${char.x},${char.y}`]);
    const dirs =[{x:0,y:1},{x:0,y:-1},{x:-1,y:0},{x:1,y:0},{x:1,y:1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1}]; 

    while(queue.length > 0) {
        let cur = queue.shift();
        for (let d of dirs) {
            let nx = cur.x + d.x, ny = cur.y + d.y;
            let key = `${nx},${ny}`;
            
            if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9 && !visited.has(key)) {
                visited.add(key);
                let isWall = state.tacData.mapGrid[ny] && state.tacData.mapGrid[ny][nx] === '#';
                let hasUnit = getUnitAt(nx, ny);
                
                if (!isWall && !hasUnit) {
                    char.x = nx; char.y = ny;
                    return; 
                } else {
                    queue.push({x: nx, y: ny}); 
                }
            }
        }
    }
};
const STATUS_ELEMENT_MAP = {
    "burn": "fire", "blaze": "fire", "aggressive": "fire", "rage": "fire", // 火炎
    "paralysis": "elec",                                         // 電撃
    "freeze": "ice", "frostbite": "ice",                         // 氷結
    "fast": "wind", "dodge": "wind",                             // 疾風
    "drown": "water", "stagnate": "water",                       // 水流
    "rot": "earth", "harden": "earth", "stone": "earth", "fortress": "earth", // 大地
    "doom": "bomb", "fragile": "bomb",                           // 爆破
    "seal": "dark", "aging": "dark", "hp_curse": "dark", "res_curse": "dark", // 暗黒
    "reverse": "wave", "exception": "wave", "repetition": "wave",// 波動
    "focus": "light", "protect": "light", "invincible": "light", "surehit": "light", // 白光
    "sleep": "mystic", "flat": "mystic",                         // 神秘
    "confusion": "spirit", "charm": "spirit", "immovable": "spirit", // 霊気
    "slow": "gravity",                                           // 重力
    "bleed": "fight", "provoke": "fight",                        // 格闘
    "poison": "grass", "deadly_poison": "grass"                  // 草花
};
// ==========================================
// 🗄️ 統合データベース（IndexedDB）管理システム
// ==========================================
const DB_NAME = 'AnkoQuestDB';
const DB_VERSION = 2; // 🌟 バージョンを上げて新しい棚を作る
const STORE_SAVE = 'saveData';     // 進行データ用
const STORE_GLOBAL = 'globalData'; // 周回・実績データ用
const STORE_EDITOR = 'editorData'; // エディタバックアップ用

const memoryDB = { [STORE_SAVE]: {}, [STORE_GLOBAL]: {}, [STORE_EDITOR]: {} };

function openDB() {
    return new Promise((resolve) => {
        try {
            if (!window.indexedDB) {
                console.warn("IndexedDBがサポートされていません。一時メモリモードで動作します。");
                return resolve(null);
            }
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_SAVE)) db.createObjectStore(STORE_SAVE);
                if (!db.objectStoreNames.contains(STORE_GLOBAL)) db.createObjectStore(STORE_GLOBAL);
                if (!db.objectStoreNames.contains(STORE_EDITOR)) db.createObjectStore(STORE_EDITOR);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => {
                console.warn("IndexedDBにアクセスできません（プライベートモード等）。一時メモリモードで動作します。");
                resolve(null); // エラーを握りつぶしてnullを返す
            };
        } catch (e) {
            console.warn("IndexedDB起動エラー。一時メモリモードで動作します。", e);
            resolve(null);
        }
    });
}
async function saveToIndexedDB(storeName, key, data) {
    const db = await openDB();
    if (!db) {
        memoryDB[storeName][key] = JSON.parse(JSON.stringify(data));
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function loadFromIndexedDB(storeName, key) {
    const db = await openDB();
    if (!db) {
        return Promise.resolve(memoryDB[storeName][key] || null);
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFromIndexedDB(storeName, key) {
    const db = await openDB();
    if (!db) {
        delete memoryDB[storeName][key];
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 🌟 旧LocalStorageからのマイグレーション（初回のみ実行）
async function migrateLocalStorage() {
    try {
        const oldGlobal = localStorage.getItem("anko_global_flags");
        if (oldGlobal) {
            await saveToIndexedDB(STORE_GLOBAL, 'flags', JSON.parse(oldGlobal));
            localStorage.removeItem("anko_global_flags");
            console.log("グローバルフラグを IndexedDB に移行しました。");
        }
        const oldBackup = localStorage.getItem("anko_editor_backup");
        if (oldBackup) {
            await saveToIndexedDB(STORE_EDITOR, 'backup', JSON.parse(oldBackup));
            localStorage.removeItem("anko_editor_backup");
            console.log("エディタバックアップを IndexedDB に移行しました。");
        }
    } catch (e) { console.error("マイグレーション失敗:", e); }
}
migrateLocalStorage();

async function checkSaveData() {
    try {
        const data = await loadFromIndexedDB(STORE_SAVE, 'slot1');
        document.getElementById('btn-load').style.display = data ? 'inline-block' : 'none';
        document.getElementById('btn-delete').style.display = data ? 'inline-block' : 'none';
    } catch (e) { }
}
window.toggleAutoSave = function () {
    if (state.enableAutoSave === undefined) state.enableAutoSave = true;
    
    state.enableAutoSave = !state.enableAutoSave;
    
    const btn = document.getElementById("btn-auto-save");
    if (btn) {
        if (state.enableAutoSave) {
            btn.innerText = "🔄 オートセーブ: ON";
            btn.style.color = "#dd6b20";
            btn.style.background = "#fffaf0";
        } else {
            btn.innerText = "⏸️ オートセーブ: OFF";
            btn.style.color = "#718096";
            btn.style.background = "#edf2f7";
        }
    }
    showToast(`オートセーブを ${state.enableAutoSave ? "ON" : "OFF"} にしました`, "info");
    
    // 設定変更自体は確実に保存しておく（手動セーブ扱い）
    saveGame(true);
};

// 🌟 修正2：セーブ関数で「自動セーブOFF」の時のブロック処理を入れる
async function saveGame(isManual = false) {
    // 🌟🌟🌟 修正：最重要のガード！！ 🌟🌟🌟
    // タクティカルで一時退避（backupPlayerが存在）している最中は、絶対にセーブしてはいけない！
    // 1vs1の途中でリロードした時は「決闘が始まる前（盤面）」から再開させるため、ここでブロックする。
    if (state.tacData && state.tacData.backupPlayer) {
        return; 
    }

    if (state.isTestPlay || state.isPvP || state.pvpBackupPlayer) return;
    
    // 手動セーブ(isManual=true)以外の時に、設定がOFFならセーブせずに帰る
    if (!isManual && state.enableAutoSave === false) {
        return; 
    }
    
    const cleanChars = (team) => {
        team.forEach(c => {
            if (!c) return;
            
            // 🌟 修正1：削除する「ゴミデータ」のリストに、タクティカルの一時座標や特性の起動フラグを追加
            const tempKeys = [
                "tempEmotion", "chargeSkillId", "rechargeTurn", "hasActed", "justEscaped", 
                "hasBursted", "guaranteeHit", "transformCrit", "guaranteeDodge", 
                "counterActive", "hasDoubleStrike", "hasBeenCountered", "turnDice", 
                "tempTensionForCalc", "critCount", "hitCombo", "lastUsedSkill", 
                "skillUseCount", "prevX", "prevY", "batteryTriggered"
            ];
            
            tempKeys.forEach(k => delete c[k]);
            
            // バトルが終わっていれば（inBattle=false）、バフや状態異常のターンも掃除
            if (!state.inBattle) {
                c.isFirstTurn = true;
                c.turnInBattle = 0;
                c.statBuff = 0;
                c.resUpShock = false; c.resUpHeat = false; c.resUpElec = false;
            }
        });
    };

    cleanChars(state.player);
    cleanChars(state.enemy);

    try {
        await saveToIndexedDB(STORE_SAVE, 'slot1', state);
        sysLog(isManual ? `[システム] 手動セーブ完了` : `[システム] オートセーブ完了`);
    } catch (e) {
        sysLog(`<span style="color:red">セーブ失敗</span>`);
        showToast("❌ セーブ失敗", "error");
    }
}
window.loadGame = async function () {
    try {
        const data = await loadFromIndexedDB(STORE_SAVE, 'slot1');
        if (data) {
            state = hydrateData(data);
            state.isTestPlay = false;

            // 🌟 修正2：ロードした直後は、どんな状態であっても「進行ブロック」をすべて破壊する！
            // これがないと、セーブデータにロックが残っていた場合に「続きから」が沈黙する
            state.isWaitingChoice = false;
            state.isAnimating = false;
            isSkipping = false;

            // バトルの途中（inBattle）でセーブされていても、ロード時は強制的に「準備フェーズ」に引き戻す
            if (state.inBattle || state.isPrepPhase) {
                state.inBattle = false;
                state.isPrepPhase = true;

                // 盤面データがあるなら、フェーズを「配置中」に強制的に戻す
                if (state.tacData) {
                    state.tacData.phase = "setup_player";
                    state.tacData.turn = "player";
                    state.tacData.setupIndex = 0; 
                }
                
                document.getElementById("story-message-box").style.display = "none";
                document.getElementById("story-choices").style.display = "none";
                document.getElementById("dice-board").style.display = "none";
                
                nextStory(); 
            } else {
                // 通常ストーリーの処理
                state.currentStepIndex = Math.max(0, state.currentStepIndex - 1);
                document.getElementById("story-choices").style.display = "none";
                document.getElementById("story-message-box").style.display = "block";
                nextStory();
            }
        }
    } catch (e) { console.error("ロード失敗", e); }
};
window.deleteSaveData = async function () {
    if (confirm("【警告】現在の進行データ（セーブデータ）を削除しますか？\n※装備やレベル、現在の物語の場所が消えます。")) {
        
        // 1. 進行データを削除
        await deleteFromIndexedDB(STORE_SAVE, 'slot1');

        if (confirm("【さらに警告】クリア回数や周回特典も完全に初期化しますか？\n※「はい」を選ぶと、クリアボーナスも貰えなくなり、完全に最初からになります。")) {
            // 2. グローバルフラグ（クリア回数など）も削除
            await deleteFromIndexedDB(STORE_GLOBAL, 'flags');
            alert("すべてのデータを完全に消去しました。");
        } else {
            alert("進行データのみ削除しました。（クリア回数は維持されます）");
        }

        await checkSaveData(); // ボタンの表示を更新
    }
};
let state = {
    activeP: 0, activeE: 0, isAnimating: false,
    day: 1, timePeriod: 1, // 🌟追加：カレンダー（0:朝, 1:昼, 2:夕, 3:夜）
    enableLevelUp: true, enableResistance: false,
    money: 500, orbShinsei: 0, ownedEquips: ["sw_1"],
    inventory: { heal_1: 3, smoke_1: 2, sniper_1: 1, decoy_1: 2, coolant_1: 2 },
    battleFlags: { guaranteeHit: false, guaranteeDodge: false, counterActive: false, statBuff: 0 },
    player: [], enemy: [],
    currentSceneId: "start", currentStepIndex: 0, isWaitingChoice: false,
    battleWinNext: null, battleLoseNext: null, battleEscapeNext: null, isTestPlay: false,
    enableLevelUp: true, enableResistance: false, enableAttribute: false, enablePartyBattle: false,
    partyBattle: null, enableAnalyze: true, flags: {}, maxLevel: 0, maxItemCount: 0, maxSkills: 0, turnCount: 1, skipHitDice: false,
    tacData: null // 🌟追加：タクティカルバトルの盤面情報
};
// 📜 バックログ保存用配列（セーブデータには含めず、プレイ中の履歴だけ保持する）
let messageLog = [];
function changeView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    document.body.style.overflow = '';
    const theaterContainer = document.getElementById('aa-iframe-container');
    if (theaterContainer) theaterContainer.classList.remove('theater-active');
    const theaterBtn = document.getElementById('btn-theater');
    if (theaterBtn) {
        theaterBtn.classList.remove('theater-btn-floating');
        theaterBtn.innerText = '全画面表示';
    }

    const sysBtn = document.getElementById("system-menu-btn");
    const logBtn = document.getElementById("log-btn-container");
    const timeDisplay = document.getElementById("time-display");

    // 🌟 修正1：ログボタンは、タイトル・待合室・エディタ以外なら「戦闘中を含めて」常に表示する！
    if (logBtn) {
        if (viewId === "view-title" || viewId === "view-online" || viewId === "view-editor") {
            logBtn.style.display = "none";
        } else {
            logBtn.style.display = "block";
        }
    }

    // 🌟 安全にセーブできる「ストーリー画面」「マップ画面」でのみUI群の表示を許可する
    const isSafeView = (viewId === "view-story" || viewId === "view-map");

    if (isSafeView) {
        if (sysBtn) sysBtn.style.display = state.isTestPlay ? "none" : "block"; // テストプレイ中はメニュー禁止
        if (typeof updateTimeUI === 'function') updateTimeUI(); // 表示判定は関数に任せる
    } else {
        // 🌟 バトル中などは「システムメニュー」と「時間表示」だけ隠す！（ログは隠さない）
        if (sysBtn) sysBtn.style.display = "none";
        if (timeDisplay) timeDisplay.style.display = "none";
    }
}


// 🌞 時間帯の更新UI
window.updateTimeUI = function () {
    const display = document.getElementById("time-display");

    // ▼ 追加：時間帯に応じた背景色(グラデーション)とAA文字色を決定
    let icon = "🌞", text = "昼", bgColor = "rgba(45,55,72,0.9)";
    let storyBg = "linear-gradient(to bottom, #ebf8ff, #bee3f8)"; // 昼
    let aaColor = "#1a202c"; // 昼の文字色（黒）

    if (state.timePeriod === 0) {
        icon = "🌅"; text = "朝"; bgColor = "rgba(135,206,235,0.9)";
        storyBg = "linear-gradient(to bottom, #fff5f5, #fed7d7)"; // 朝
    } else if (state.timePeriod === 1) {
        icon = "🌞"; text = "昼"; bgColor = "rgba(45,55,72,0.9)";
        storyBg = "linear-gradient(to bottom, #ebf8ff, #bee3f8)"; // 昼
    } else if (state.timePeriod === 2) {
        icon = "🌇"; text = "夕"; bgColor = "rgba(221,107,32,0.9)";
        storyBg = "linear-gradient(to bottom, #feebc8, #fbd38d)"; // 夕
    } else if (state.timePeriod === 3) {
        icon = "🌙"; text = "夜"; bgColor = "rgba(42,67,101,0.9)";
        storyBg = "linear-gradient(to bottom, #2a4365, #1a365d)"; // 夜
        aaColor = "#e2e8f0"; // 夜の文字色
    }

    // 🌟 ここを追加！：エディタで専用の背景が指定されていたら上書きする
    if (state.customBg) {
        storyBg = state.customBg;
        // 背景が暗いプリセット（洞窟・魔王城・異空間など）の場合は、文字色を自動で白くする
        if (state.customBg.includes("#718096") || state.customBg.includes("#e9d8fd") || state.customBg.includes("#fed7d7")) {
            aaColor = "#e2e8f0";
        }
    }
    // 手動で文字色が指定されていたら、さらに上書きする
    if (state.customTextColor) {
        aaColor = state.customTextColor;
    }

    // ▼ ストーリー画面の背景色とAA文字色を適用
    const storyView = document.getElementById("view-story");
    if (storyView) storyView.style.background = storyBg;
    const storyAA = document.getElementById("story-aa");
    if (storyAA) storyAA.style.color = aaColor;
    const msgBox = document.getElementById("story-message-box");
    const speakerLabel = document.getElementById("story-speaker");

    if (msgBox) {
        // 設定があれば適用、なければデフォルト（半透明黒）
        msgBox.style.backgroundColor = state.customMsgBg || "rgba(0,0,0,0.85)";
        msgBox.style.color = state.customMsgText || "#ffffff";
        msgBox.style.transition = "background-color 1s, color 1s";
    }
    if (speakerLabel) {
        speakerLabel.style.color = state.customMsgSpeaker || "#ecc94b";
        speakerLabel.style.transition = "color 1s";
    }
    if (!display) return;

    // 🌟 システム設定で無効化されている場合はUIを隠し、背景を「昼」に固定する
    if (state.enableTimeSystem === false || state.enableTimeSystem === "false") {
        display.style.display = "none";
        if (storyView) storyView.style.background = "linear-gradient(to bottom, #ebf8ff, #bee3f8)";
        if (storyAA) storyAA.style.color = "#1a202c";
        return;
    }

    display.style.display = "flex";
    document.getElementById("time-day-val").innerText = state.day;
    document.getElementById("time-icon").innerText = icon;
    document.getElementById("time-period-val").innerText = text;
    display.style.background = bgColor;
};

window.toggleSystemMenu = function () {
    const modal = document.getElementById("system-menu-modal");
    const isOpening = modal.style.display !== "flex";

    if (isOpening) {
        const moneyEl = document.getElementById("sys-money-val");
        const orbEl = document.getElementById("sys-orb-val");
        if (moneyEl) moneyEl.innerText = state.money || 0;
        if (orbEl) orbEl.innerText = state.orbShinsei || 0;

        const btnSpeed = document.getElementById("btn-msg-speed");
        if (btnSpeed) {
            let spd = state.msgSpeed !== undefined ? state.msgSpeed : 1.0;
            if (spd === 1.0) btnSpeed.innerText = "⏩ メッセージ速度: 普通";
            else if (spd === 0.5) btnSpeed.innerText = "🚀 メッセージ速度: 速い";
            else btnSpeed.innerText = "⚡ メッセージ速度: 超速い";
        }

        // 🌟 追加：オートセーブボタンの現在の状態を同期
        const btnAuto = document.getElementById("btn-auto-save");
        if (btnAuto) {
            let isAuto = state.enableAutoSave !== false; // デフォルトは true
            if (isAuto) {
                btnAuto.innerText = "🔄 オートセーブ: ON";
                btnAuto.style.color = "#dd6b20";
                btnAuto.style.background = "#fffaf0";
            } else {
                btnAuto.innerText = "⏸️ オートセーブ: OFF";
                btnAuto.style.color = "#718096";
                btnAuto.style.background = "#edf2f7";
            }
        }
    }

    // 表示の切り替え
    modal.style.display = isOpening ? "flex" : "none";

    // 背景のクリック防止コントロール
    const container = document.querySelector(".app-container");
    if (container) container.style.pointerEvents = isOpening ? "none" : "auto";
    modal.style.pointerEvents = "auto";
};
window.closeSystemMenu = function () {
    document.getElementById("system-menu-modal").style.display = "none";
    const container = document.querySelector(".app-container");
    if (container) container.style.pointerEvents = "auto";

    // 🌟 追加：フォーカスを安全な場所（全体コンテナ）に戻してキーボード操作を復活させる
    if (container) container.focus();
};
window.manualSave = async function () {
    if (state.isTestPlay || state.isPvP || state.pvpBackupPlayer) {
        showToast("⚠️ 対戦・テスト中はセーブできません", "warning");
        return;
    }
    // 🌟変更：手動セーブであることを引数(true)で伝える
    await saveGame(true);
    showToast("💾 進行状況を手動でセーブしました！", "success");
    closeSystemMenu();
};

window.returnToTitle = async function () {
    // 1. PvP（オンライン対戦）中の場合：降参してロビーへ戻る
    if (state.isPvP) {
        if (confirm("この対戦をギブアップして、ロビーに戻りますか？")) {
            if (conn && conn.open) {
                conn.send({ type: 'PVP_GAME_OVER', result: '対戦相手がギブアップしました' });
            }
            closeSystemMenu();
            endPvP(false); // 🌟 引数 false で通信を切らずにロビーへ戻る
        }
        return;
    }

    // 2. タクティカルバトル（盤面ソロプレイ）中の場合：降参（敗北イベント）
    if (state.tacData) {
        if (confirm("この戦いを諦めますか？\n（敗北扱いとしてストーリーが進行します）")) {
            closeSystemMenu();
            state.tacData = null; // 盤面データを破棄
            state.isAnimating = false;
            jumpTo(state.battleLoseNext); // 敗北ルートへジャンプ
        }
        return;
    }

    // 3. 通常バトル・ストーリー・マップ等：タイトルへ戻る
    if (confirm("タイトルに戻りますか？\n(セーブしていない進行状況は失われます)")) {
        closeSystemMenu();
        cleanupGameState();

        const exitBtn = document.getElementById("btn-exit-test");
        if (exitBtn) exitBtn.style.display = "none";

        changeView("view-title");
    }
};

window.customPlayerTeam = null;

window.startGame = async function () {
    cleanupGameState();

    let sourceTeam = (window.customPlayerTeam !== null && window.customPlayerTeam.length > 0) ? window.customPlayerTeam : INITIAL_PLAYER_TEAM;

    // 🌟 修正：全員ではなく、先頭の1人（主人公）だけを初期パーティに入れる
    let initialPlayers = [JSON.parse(JSON.stringify(sourceTeam[0]))];
    let hydratedData = window.hydrateData({ player: initialPlayers });

    state.player = hydratedData.player;
    state.player.forEach(p => p.originalId = p.id);

    // 4. シナリオの開始地点を決定
    let firstSceneId = "start";
    if (Object.keys(SCENARIO).length === 0) {
        alert("シナリオデータが空っぽです！エディタでシーンを作成するか、ファイルを読み込んでください。");
        changeView("view-title");
        return;
    }
    if (!SCENARIO["start"]) firstSceneId = Object.keys(SCENARIO)[0];

    console.log("Game Starting at:", firstSceneId);
    jumpTo(firstSceneId);
};

window.openImportModal = function () { document.getElementById('import-modal').style.display = 'flex'; }
window.closeImportModal = function () { document.getElementById('import-modal').style.display = 'none'; }
window.executeImport = function () {
    try {
        const data = JSON.parse(document.getElementById('import-textarea').value);

        // ▼ 追加：シナリオデータが圧縮配列形式なら解凍する
        let loadedScenario = data.SCENARIO;
        if (loadedScenario) {
            const firstSceneKey = Object.keys(loadedScenario)[0];
            if (firstSceneKey && Array.isArray(loadedScenario[firstSceneKey][0])) {
                loadedScenario = unpackScenario(loadedScenario);
            }
            Object.assign(SCENARIO, loadedScenario);
        }

        if (data.ENEMY_MASTER) Object.assign(ENEMY_MASTER, data.ENEMY_MASTER);
        if (data.ITEMS) Object.assign(ITEMS, data.ITEMS);
        if (data.SKILLS) Object.assign(SKILLS, data.SKILLS);
        if (data.PLAYER_TEAM) window.customPlayerTeam = data.PLAYER_TEAM;

        alert("読込完了"); closeImportModal(); startGame();
    } catch (e) { alert("JSONエラー"); }
}
window.openEditor = function () { changeView("view-editor"); }
window.closeEditor = function () { changeView("view-title"); }

function playGlitchEffect() { document.body.classList.add("glitch-active"); if (navigator.vibrate) navigator.vibrate([100, 50, 200]); setTimeout(() => { document.body.classList.remove("glitch-active"); }, 300); }
function showWarning() { return new Promise(resolve => { const w = document.getElementById("warning-layer"); w.style.display = "flex"; if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); setTimeout(() => { w.style.display = "none"; resolve(); }, 2500); }); }

window.getFace = async function (char) {
    if (!char) return "(ERROR: NO CHAR)";

    // 🌟 現在の状況から「要求する表情」を決定
    let variant = "通常";
    if (char.tempEmotion) {
        variant = char.tempEmotion; // "攻撃" などが一時的に入る
    } else {
        if (char.hp <= 0) variant = "ダメージ";
        else if (state.enableResistance && (char.breakShock > 0 || char.breakHeat > 0 || char.breakElec > 0)) variant = "ピンチ";
        else if (char.hp <= char.maxHp / 2) variant = "ピンチ";
    }

    let finalAA = "";

    // 1. オブジェクト形式（新・カスタムAA対応）の場合
    if (typeof char.aa === "object" && char.aa !== null) {
        let targetAA = char.aa[variant] || char.aa["ダメージ"] || char.aa["ピンチ"] || char.aa["通常"] || "";

        if (targetAA.includes('.') && !targetAA.includes('\n')) {
            let basePath = targetAA;
            if (basePath.endsWith(".通常")) basePath = basePath.replace(".通常", "");
            else if (basePath.endsWith(".ピンチ")) basePath = basePath.replace(".ピンチ", "");
            else if (basePath.endsWith(".ダメージ")) basePath = basePath.replace(".ダメージ", "");

            // 🚨 修正：AAが見つからなくてフリーズするのを防ぐため、.catch() でガードする！
            let resolved = await resolveAA(`${basePath}.${variant}`).catch(() => `${basePath}.${variant}`);
            if (resolved === `${basePath}.${variant}`) resolved = await resolveAA(targetAA).catch(() => targetAA);
            finalAA = resolved;

            if (finalAA.includes('.') && !finalAA.includes('\n')) {
                return `[ 読み込み失敗 ]\nパス: ${finalAA}\nファイル ./aa_library/${finalAA.toLowerCase().split('.').slice(0,3).join('/')}.mlt があるか確認してね`;
            }
        }
        else {
            finalAA = window.decodeAA(targetAA);
        }
    }
    // 2. 文字列形式（古いセーブデータや未移行のデータ）のフォールバック
    else if (typeof char.aa === "string") {
        let decodedAA = window.decodeAA(char.aa);

        if (decodedAA.includes('\n') || decodedAA.length > 50) {
            finalAA = decodedAA;
        } else {
            let basePath = decodedAA;
            if (basePath.endsWith(".通常")) basePath = basePath.replace(".通常", "");
            else if (basePath.endsWith(".ピンチ")) basePath = basePath.replace(".ピンチ", "");
            else if (basePath.endsWith(".ダメージ")) basePath = basePath.replace(".ダメージ", "");

            // 🚨 修正：ここも同様にフリーズ防止のガードをつける
            let resolved = await resolveAA(`${basePath}.${variant}`).catch(() => `${basePath}.${variant}`);
            if (resolved === `${basePath}.${variant}`) resolved = await resolveAA(decodedAA).catch(() => decodedAA);
            finalAA = resolved;

            if (finalAA.includes('.') && !finalAA.includes('\n')) {
                return `[ 読み込み失敗 ]\nパス: ${finalAA}\nファイル ./aa_library/${finalAA.toLowerCase().split('.').slice(0,3).join('/')}.mlt があるか確認してね`;
            }
        }
    }

    if (!finalAA || finalAA.trim() === "") {
        return `[ ${char.name} : AA未設定 ]\n(エディタでAAを設定してください)`;
    }

    return finalAA;
};
window.jumpTo = function (sceneId) {
    if (typeof mapState !== 'undefined') mapState.isJumpingToScene = false;

    // タイマー・ループ系の停止
    if (typeof mapState !== 'undefined' && mapState.loopId) {
        clearInterval(mapState.loopId);
        mapState.loopId = null;
    }
    if (typeof clearMapTimers === 'function') clearMapTimers();
    if (typeof agState !== 'undefined') {
        if (agState.loopId) { clearInterval(agState.loopId); clearTimeout(agState.loopId); agState.loopId = null; }
        if (agState.qteTimeout) { clearTimeout(agState.qteTimeout); agState.qteTimeout = null; }
        agState.isPlaying = false;
    }
    if (typeof turnTimerInterval !== 'undefined' && turnTimerInterval) clearInterval(turnTimerInterval);

    // ==========================================
    // 🌟 バトル・盤面フラグの完全強制切断
    // ==========================================
    state.inBattle = false;
    state.isPrepPhase = false;
    state.partyBattle = null; 
    state.tacData = null;     
    state.isAnimating = false;
    isSkipping = false; 

    // バトル系グローバルフラグの初期化
    state.shingariActive = false;
    state.battleFlags = { guaranteeHit: false, transformCrit: false, guaranteeDodge: false, counterActive: false, statBuff: 0, earnedMoney: 0, earnedExp: 0, resUpShock: false, resUpElec: false, scoutedList: [] };
    state.turnCount = 1; // ターンリセット

    // UIのゴミ（ダイスボードやカットインなど）を強制消去
    const elementsToHide = ["dice-board", "battle-cutin", "timer-display", "pvp-timer-display", "warning-layer", "story-choices", "story-dice-area"];
    elementsToHide.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });

    // 操作ロックを強制解除（フリーズ防止）
    const appContainer = document.querySelector(".app-container");
    if (appContainer) appContainer.style.pointerEvents = "auto";
    
    if (typeof currentMsgResolve === "function" && currentMsgResolve) {
        currentMsgResolve();
    }
    // ==========================================

    if (!SCENARIO[sceneId] || SCENARIO[sceneId].length === 0) {
        console.error("Missing or Empty Scene:", sceneId);
        showToast(`🚨 エラー: シーン「${sceneId}」が存在しないか、空っぽです！`, "error");
        forceReturnFromError();
        return;
    }

    // 現在のシーンIDを更新
    state.lastBattleSceneId = state.currentSceneId; 
    state.currentSceneId = sceneId;
    state.currentStepIndex = 0;
    state.isWaitingChoice = false;

    // UI表示の制御
    const exitBtn = document.getElementById("btn-exit-test");
    if (exitBtn) exitBtn.style.display = state.isTestPlay ? "block" : "none";
    const sysBtn = document.getElementById("system-menu-btn");
    if (sysBtn) sysBtn.style.display = state.isTestPlay ? "none" : "block";

    document.getElementById("story-message-box").style.display = "block";

    saveGame();
    nextStory();
};


function initResistance(char, isPlayer = false) {
    const stats = getStats(char, isPlayer, "none", false);
    char.curShock = stats.maxShock || 100; char.curHeat = stats.maxHeat || 100; char.curElec = stats.maxElec || 100;
    char.breakShock = 0; char.breakHeat = 0; char.breakElec = 0;
}
window.expandVariables = async function (str) {
    if (typeof str !== "string") return str;
    if (!str.includes("{")) return str;

    const gf = (await loadFromIndexedDB(STORE_GLOBAL, 'flags')) || {};

    // 🌟 第1段階：通常の変数（{yaruo.hp} など）を展開して数値や文字にする
    let expandedStr = str.replace(/\{([^{}?:]+)\}/g, (match, key) => {
        key = key.trim();

        // 1. システム変数
        if (key === "money") return state.money || 0;
        if (key === "orb_shinsei" || key === "orbShinsei") return state.orbShinsei || 0;
        if (key === "day") return state.day || 1;
        if (key === "timePeriod" || key === "time") return state.timePeriod || 0;

        // 2. グローバルフラグ
        if (key.startsWith("G_") && gf[key] !== undefined) return gf[key];

        // 3. 進行フラグ
        if (state.flags[key] !== undefined) return state.flags[key];

        // 4. パーティの並び順指定 (例: p1.name)
        const matchArray = key.match(/^([pe])(\d+)\.(.+)$/i);
        if (matchArray) {
            const isPlayer = matchArray[1].toLowerCase() === 'p';
            const index = parseInt(matchArray[2], 10) - 1;
            const targetTeam = isPlayer ? state.player : state.enemy;
            if (targetTeam[index] && targetTeam[index][stat] !== undefined) return targetTeam[index][stat];
        }

        // 5. 個別キャラのID指定 (例: yaruo.affection)
        if (key.includes(".")) {
            const [cId, stat] = key.split(".");
            let p = state.player.find(x => x.id === cId || x.originalId === cId) || 
                    state.enemy.find(x => x.id === cId || x.originalId === cId);
            if (p && p[stat] !== undefined) return p[stat];
        }

        // 6. 見つからなければ先頭キャラのステータス
        if (state.player[0] && state.player[0][key] !== undefined) return state.player[0][key];

        return match;
    });

    // 🌟 第2段階：動的分岐（三項演算子）の処理
    expandedStr = expandedStr.replace(/\{([^?]+)\?([^:]+):([^}]+)\}/g, (match, condition, trueStr, falseStr) => {
        try {
            const result = new Function('return ' + condition)();
            return result ? trueStr.trim() : falseStr.trim();
        } catch (e) {
            // 🌟 修正：文字列比較などで new Function が落ちた場合の安全なフォールバック
            let parts = condition.split(/(===|!==|==|!=|>=|<=|>|<)/);
            if (parts.length === 3) {
                let left = parts[0].trim();
                let op = parts[1].trim();
                let right = parts[2].trim();
                let res = false;
                if (!isNaN(left) && !isNaN(right)) { left = Number(left); right = Number(right); }
                if (op === "==" || op === "===") res = (left == right);
                if (op === "!=" || op === "!==") res = (left != right);
                if (op === ">=") res = (left >= right);
                if (op === "<=") res = (left <= right);
                if (op === ">") res = (left > right);
                if (op === "<") res = (left < right);
                return res ? trueStr.trim() : falseStr.trim();
            }
            console.warn("動的分岐の計算に失敗しました:", condition);
            return falseStr.trim();
        }
    });

    return expandedStr;
};
window.nextStory = async function () {
    if (state.isWaitingChoice) return;
    isSkipping = false;
    const scene = SCENARIO[state.currentSceneId];
    if (!scene) {
        console.error("Scene not found:", state.currentSceneId);
        return;
    }
    if (state.currentStepIndex >= scene.length) {
        console.error("End of scene reached without jump or end step.");
        showToast(`🚨 エラー: このシーン（${state.currentSceneId}）の終点に到達しました。<br>ジャンプ先が設定されていません！`, "error");

        // ▼ 二重発火を防ぐ安全な送還処理へ
        forceReturnFromError();
        return;
    }
    for (let i = 1; i <= 5; i++) {
        const futureStep = scene[state.currentStepIndex + i];
        if (futureStep && futureStep.aa && typeof resolveAA === 'function') {
            // awaitを付けないことで、ゲームの進行を止めずにバックグラウンドで通信させる
            resolveAA(futureStep.aa).catch(() => { });
        }
    }
    const step = scene[state.currentStepIndex];

    // --- 【重要】変数を定義し、表示要素を一度すべて隠す（画面真っ白対策） ---
    const msgBox = document.getElementById("story-message-box");
    const choices = document.getElementById("story-choices");
    const diceArea = document.getElementById("story-dice-area");

    if (msgBox) msgBox.style.display = "none";
    if (choices) choices.style.display = "none";
    if (diceArea) diceArea.style.display = "none";

    // --- ステップごとの処理 ---
    if (step.type === "system_set") {
        if (step.enableTension !== undefined) state.enableTension = step.enableTension;
        if (step.enableLevelUp !== undefined) state.enableLevelUp = step.enableLevelUp;
        if (step.enableResistance !== undefined) state.enableResistance = step.enableResistance;
        if (step.enableAttribute !== undefined) state.enableAttribute = step.enableAttribute;
        if (step.enableStatus !== undefined) {
            state.enableStatus = step.enableStatus;
            if (!state.enableStatus) {
                [...state.player, ...state.enemy].forEach(c => {
                    if (c && c.status !== "none") {
                        c.status = "none";
                        c.statusTurn = 0;
                    }
                });
            }
        }
        if (step.enablePartyBattle !== undefined) state.enablePartyBattle = step.enablePartyBattle;
        if (step.enableAnalyze !== undefined) state.enableAnalyze = step.enableAnalyze;
        if (step.maxLevel !== undefined) state.maxLevel = step.maxLevel;
        if (step.maxItemCount !== undefined) state.maxItemCount = step.maxItemCount;
        if (step.maxSkills !== undefined) state.maxSkills = step.maxSkills;
        if (step.skipHitDice !== undefined) state.skipHitDice = step.skipHitDice;
        if (step.enableEscape !== undefined) state.enableEscape = step.enableEscape;
        if (step.enableScout !== undefined) state.enableScout = step.enableScout;
        if (step.maxPlayerCount !== undefined) state.maxPlayerCount = Number(step.maxPlayerCount);
        if (step.timeLimit !== undefined) state.timeLimit = Number(step.timeLimit);
        if (step.turnLimit !== undefined) state.turnLimit = Number(step.turnLimit);
        if (step.enablePermaDeath !== undefined) state.enablePermaDeath = step.enablePermaDeath;
        if (step.maxPartyCost !== undefined) state.maxPartyCost = Number(step.maxPartyCost);
        if (step.enableTimeSystem !== undefined) state.enableTimeSystem = step.enableTimeSystem;
        if (step.enableMultiEquip !== undefined) state.enableMultiEquip = step.enableMultiEquip;
        if (step.enableTactical !== undefined) state.enableTactical = step.enableTactical;
        if (step.enableEvolution !== undefined) state.enableEvolution = step.enableEvolution;
        let prevMemberCount = state.battleMemberCount || 3;
        if (step.battleMemberCount !== undefined) {
            state.battleMemberCount = Math.max(1, Number(step.battleMemberCount));
            // 人数が減らされた場合、はみ出たキャラ（後衛行き）の「アクティブ状態」を解除する
            if (state.battleMemberCount < prevMemberCount) {
                if (state.activeP >= state.battleMemberCount) state.activeP = 0;
            }
        }

        // 🌟 修正：装備枠の変更と自動回収（超過分をインベントリに戻す）
        let prevEquipCount = state.maxEquipCount || 1;
        if (step.maxEquipCount !== undefined) {
            state.maxEquipCount = Math.max(1, Number(step.maxEquipCount));
            if (state.maxEquipCount < prevEquipCount) {
                state.player.forEach(p => {
                    if (Array.isArray(p.equips) && p.equips.length > state.maxEquipCount) {
                        let overEquips = p.equips.slice(state.maxEquipCount);
                        overEquips.forEach(eid => {
                            if (eid && eid !== "none") state.ownedEquips.push(eid);
                        });
                        p.equips = p.equips.slice(0, state.maxEquipCount);
                    }
                });
            }
        }

        state.currentStepIndex++;
        await nextStory();

    } else if (step.type === "msg") {
        changeView("view-story");
        if (msgBox) msgBox.style.display = "block";

        // 1. まず変数展開やAAデータの取得を全て終わらせる
        let spk = await expandVariables(step.speaker || "");
        let txt = await expandVariables(step.text || "");
        let aaRaw = await resolveAA(step.aa);

        // 2. 画面上の名前とAAを更新する
        document.getElementById("story-speaker").innerText = spk;
        const storyAAEl = document.getElementById("story-aa");
        storyAAEl.innerText = aaRaw;

        // 3. 🌟【ここが最重要】文字送り(showMsg)が始まる「前」にサイズを合わせる！
        // これにより、文字が出てくる瞬間にはもう完璧なサイズになっています。
        fitAAToContainer(storyAAEl, storyAAEl.parentElement);

        // 4. 準備が整ってから文字送りを開始する
        state.isWaitingChoice = true;
        await showMsg(txt);

        state.isWaitingChoice = false;
        state.currentStepIndex++;

    } else if (step.type === "choice") {
        changeView("view-story");
        if (msgBox) msgBox.style.display = "block";
        state.isWaitingChoice = true;
        if (choices) {
            // 🌟 選択肢のテキストにも変数展開を適用
            let htmls = [];
            for (let c of step.choices) {
                let cText = await expandVariables(c.text);
                htmls.push(`<button class="btn-choice" onclick="event.stopPropagation(); jumpTo('${c.next}')">${cText}</button>`);
            }
            choices.innerHTML = htmls.join("");
            choices.style.display = "flex";
        }
    } else if (step.type === "dice_choice") {
        changeView("view-story");
        if (msgBox) msgBox.style.display = "block";

        document.getElementById("story-speaker").innerText = await expandVariables(step.speaker || "");
        document.getElementById("story-text").innerText = await expandVariables(step.text || "");
        document.getElementById("story-aa").innerText = await resolveAA(step.aa);

        // 🌟 ダイスの最大値（1d100の100の部分）も変数で指定できるようにする
        state.currentStoryDiceMax = Number(await expandVariables(String(step.diceMax))) || 100;

        state.isWaitingChoice = true;
        if (diceArea) diceArea.style.display = "flex";

        // 🌟 修正：id の story- を適切に指定
        document.getElementById("story-dice-inst").innerText = "運命のダイス判定";
        document.getElementById("story-stat-dice-val").innerText = "?";
        document.getElementById("btn-roll-story").style.display = "block";
        document.getElementById("btn-roll-story").onclick = rollStoryDice;
        document.getElementById("story-stat-roll-actions").style.display = "none";

    } else if (step.type === "stat_roll") {
        changeView("view-story");
        if (msgBox) msgBox.style.display = "block";

        document.getElementById("story-speaker").innerText = await expandVariables(step.speaker || "");
        document.getElementById("story-text").innerText = await expandVariables(step.text || "");
        document.getElementById("story-aa").innerText = await resolveAA(step.aa);
        state.isWaitingChoice = true;

        let rollQueue = step.rolls || [];
        if (rollQueue.length === 0 && step.statKey) {
            rollQueue.push({ key: step.statKey, exp: `${step.diceCount || 1}d${step.diceMax || 100}+${step.baseVal || 0}` });
        }

        // 🌟 ダイスの計算式（1d100+10 など）の中の変数を展開してからセットする
        for (let r of rollQueue) {
            r.exp = await expandVariables(r.exp);
        }

        state.currentStatRoll = {
            targetId: step.targetId || "",
            queue: rollQueue,
            currentIndex: 0,
            remains: step.rerolls !== undefined ? step.rerolls : 3,
            results: {},
            isRolling: false
        };

        if (diceArea) diceArea.style.display = "flex";
        prepareNextStatRoll();


    } else if (step.type === "map") {
        saveGame();
        // 🌟修正：戦闘モードかどうかで分岐させる
        if (step.isBattle) {
            startTacticalBattle(step); // 盤面戦闘を開始（ロジックは別途追加）
        } else {
            startMapMode(step); // 従来のマップ移動を開始
        }
        return;
    } else if (step.type === "party_edit") {
        openStorage(); return;} 
         else if (step.type === "join_party") {
        let sourceTeam = (window.customPlayerTeam && window.customPlayerTeam.length > 0) ? window.customPlayerTeam : INITIAL_PLAYER_TEAM;
        let charData = sourceTeam.find(c => c.id === step.targetId);
        
        if (charData) {
            let alreadyExists = state.player.some(p => p.originalId === charData.id || p.id === charData.id);
            
            if (!alreadyExists) {
                let newAlly = JSON.parse(JSON.stringify(charData));
                newAlly.originalId = charData.id;
                newAlly.id = `${charData.id}_${Date.now()}`;
                
                // 🌟 修正1：ここが原因でした。全体を hydrate(初期化)するのではなく、新しい仲間「だけ」を初期化する
                if (typeof window.hydrateData === 'function') {
                    // ダミーの配列に入れて newAlly だけを補完させる（やる夫は巻き込まれない）
                    let hydrated = window.hydrateData({ player: [newAlly] });
                    newAlly = hydrated.player[0];
                }
                state.player.push(newAlly); 
                
                let limitMsg = "";
                const travelPartyLimit = 8;
                if (state.player.length > travelPartyLimit) {
                    limitMsg = `\n（同行枠がいっぱいのため、預かり所に送られた）`;
                }
                
                if (step.msg) {
                    changeView("view-story");
                    const msgBox = document.getElementById("story-message-box");
                    if (msgBox) msgBox.style.display = "block";
                    document.getElementById("story-speaker").innerText = "システム";
                    let displayMsg = step.msg.replace(/\{name\}/g, newAlly.name) + limitMsg;
                    document.getElementById("story-text").innerText = await expandVariables(displayMsg);
                    document.getElementById("story-aa").innerText = "";
                    state.currentStepIndex++;
                    return; 
                }
            }
        }
        state.currentStepIndex++;
        await nextStory();
    } else if (step.type === "fusion") {
        openFusion(); return;
    }
    else if (step.type === "shop") {
        saveGame();
        openShop();

  

} else if (step.type === "battle") {
        if (!state.inBattle) {
            [...state.player, ...state.enemy].forEach(c => {
                if (c) {
                    c.x = -1; 
                    c.y = -1; 
                    c.hasActed = false;
                    c.prevX = undefined;
                    c.prevY = undefined;
                }
            });
        }

        // 🌟 前半：まだ準備フェーズにもバトル本番にも入っていない場合（完全な初期化）
        if (!state.inBattle && !state.isPrepPhase) {
            
            // 敵の生成、ステータスなどの初期化
            if (step.enemies && step.enemies.length > 0) {
                state.enemy = step.enemies.map((n, idx) => {
                    let e = JSON.parse(JSON.stringify(ENEMY_MASTER[n]));
                    if (e) {
                        e.id = `${e.id}_${Date.now()}_${idx}`; // ユニークID付与
                        if (typeof initResistance === 'function') initResistance(e, false);
                    }
                    return e;
                }).filter(e => e);
                
                state.player.forEach(p => { if (typeof initResistance === 'function') initResistance(p, true); });

                state.enemy.forEach(e => getFace(e).catch(() => { }));
                state.player.slice(0, state.battleMemberCount || 3).forEach(p => getFace(p).catch(() => { }));

                state.activeE = 0;
                state.battleFlags = { guaranteeHit: false, transformCrit: false, guaranteeDodge: false, counterActive: false, statBuff: 0, earnedMoney: 0, earnedExp: 0, resUpShock: false, resUpElec: false, scoutedList:[] };
                state.turnCount = 1;
                
                // 🌟 ここが重要：味方・敵の状態と「座標」を完全にリセット
                [...state.player, ...state.enemy].forEach(c => {
                    if (c) {
                        c.critCount = 0; c.hitCombo = 0; c.lastUsedSkill = null; c.skillUseCount = 0;
                        c.isFirstTurn = true; c.hasExtraTurn = false; c.rechargeTurn = 0; c.chargeSkillId = null;
                        c.hasDoubleStrike = false; c.turnInBattle = 0; c.hasBursted = false;
                        c.status = "none"; c.statusTurn = 0; c.statBuff = 0;
                        c.tension = 0; 
                        c.x = -1; c.y = -1; c.hasActed = false;
                        c.prevX = undefined; c.prevY = undefined;
                    }
                });

                state.tacData = null;
                
                // システム設定ON、またはマップデータが存在する場合は強制的にタクティカルモードにする
                let forceTactical = state.enableTactical || (step.mapData && step.mapData.trim() !== "");
                
                if (forceTactical) {
                    state.tacData = {
                        initiative: step.initiative || "stats",
                        useBattleDice: step.useBattleDice || false,
                        mapGrid: step.mapData ? step.mapData.split('\n') : Array(9).fill("........."),
                        phase: "setup_player", 
                        selectedUnit: null, 
                        movedUnit: null, 
                        focusedUnit: null, // 注視状態（誰を見ているか）も確実に初期化
                        turn: "player"
                    };
                }
                if (!state.isPvP && typeof triggerOmenTrait === 'function') triggerOmenTrait();
            }

            isSkipping = false;
            state.battleWinNext = step.win;
            state.battleLoseNext = step.lose;
            state.battleDrawNext = step.draw || step.lose;
            state.battleEscapeNext = step.escape || step.lose;
            state.battleScoutNext = step.scout || null;
            state.battleScoutSuccess = false;

            // 🌟 絶対防衛線：敵陣のロード完了後、絶対に準備フェーズにする
            state.isPrepPhase = true;
            
            if (state.enemy.some(en => en.isBoss === "true")) {
                showWarning();
            }
            
            if (!state.player[state.activeP] || state.player[state.activeP].hp <= 0) {
                let firstAlive = state.player.findIndex(p => p.hp > 0);
                state.activeP = firstAlive !== -1 ? firstAlive : 0;
            }

            sysLog(`[システム] 戦闘準備フェーズ開始`);
            saveGame();
            updatePrepUI();
            
            // 🌟 究極防衛線：ここで強制的に処理を「終了」させ、これより下のコードを絶対に読ませない！
            changeView("view-prep");
            return; 
        }

        // 🌟 中盤：準備画面（isPrepPhase）でまだボタンを押していない場合
        // （ロードして復帰した時や、上のreturnを突破してきたバグを防ぐ）
        if (state.isPrepPhase && !state.inBattle) {
            updatePrepUI(); 
            changeView("view-prep"); 
            return; // 🌟 ここでも強制ストップ！
        }

        // ========================================================
        // 🌟 ここから下は、「バトル開始！！」ボタンが押されて
        //    state.isPrepPhase = false;
        //    state.inBattle = true;
        //    になった時【だけ】実行される聖域です
        // ========================================================

        let forceTactical = state.enableTactical || (state.tacData !== null);

        // タクティカルモードの起動・復帰
        if (forceTactical && state.tacData) {
            changeView("view-tactical");
            
            // ロード復帰時（battleフェーズ）でも、必ずマス目だけは再生成する
            if (state.tacData.phase === "setup_player") {
                initTacticalBoard();
            } else {
                initTacticalBoard(); // 盤面（マス目）を生成してから
                updateTacticalUI();  // キャラの座標を復元する
            }
            return; // 🌟 盤面を描いたらここで終了。下の通常バトル処理には行かない。
        }

        // 通常バトルの起動・復帰
        changeView("view-battle");

        // 前の戦闘のメッセージ（〇〇Gを手に入れた等）が残っていたら、空っぽに掃除する！
        const msgWin = document.getElementById("msg-window");
        if (msgWin) {
            msgWin.innerHTML = "";
        }

        if (state.enablePartyBattle) {
            if (!state.partyBattle || !state.partyBattle.actions) {
                await showMsg(`敵の群れが あらわれた！`);
                state.partyBattle = { phase: 'command', currentActorIdx: -1, actions:[] };
            }
            await updateUI();
            if (state.partyBattle.phase === 'command') nextPartyCommand();
        } else {
            if (!state.player[state.activeP] || state.player[state.activeP].hp <= 0) {
                let aliveIdx = state.player.findIndex(p => p && p.hp > 0);
                state.activeP = aliveIdx !== -1 ? aliveIdx : 0;
            }
            if (state.player[state.activeP] && state.player[state.activeP].turnDice === undefined) state.player[state.activeP].turnDice = 0;
            if (state.enemy[state.activeE] && state.enemy[state.activeE].turnDice === undefined) state.enemy[state.activeE].turnDice = 0;
            
            await updateUI();
            
            // ロード復帰時、もしメッセージが出ていなければ出す
            if (!document.getElementById("msg-window").innerText) {
                await showMsg(`あ！ ${state.enemy[0].name} たちが現れた！`);
            }
            startTurnTimer();
            setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 100);
        }
    }
  else if (step.type === "stat_change") {
        let targets = (!step.targetId || step.targetId.trim() === "") ? state.player : state.player.filter(p => p.id === step.targetId || p.originalId === step.targetId);
        const mode = step.mode || "recover";

        const statKeys = (step.statKey || "hp").split(",").map(s => s.trim()).filter(s => s);

        let amtStr = await expandVariables(String(step.amount));
        let finalAmt = 0;
        if (isNaN(Number(amtStr)) && !statKeys.some(k => k.startsWith("aff_"))) {
            try { finalAmt = new Function('return ' + amtStr)(); } catch (e) { finalAmt = 0; }
        } else if (!isNaN(Number(amtStr))) {
            finalAmt = Number(amtStr);
        } else {
            finalAmt = amtStr;
        }

        if (statKeys.includes("money")) {
            let nextMoney = (mode === "set") ? finalAmt : (state.money + finalAmt);
            state.money = Math.max(0, Math.min(99999999, nextMoney));
        }
        if (statKeys.includes("orb_shinsei")) {
            let nextOrb = (mode === "set") ? finalAmt : ((state.orbShinsei || 0) + finalAmt);
            state.orbShinsei = Math.max(0, Math.min(99, nextOrb));
        }
        for (let p of targets) {
            for (let statKey of statKeys) {
                if (statKey === "money" || statKey === "orb_shinsei") continue;

                // テンションの操作は専用関数（特性ガードあり）を通す
                if (statKey === "tension") {
                    if (mode === "set") {
                        let diff = finalAmt - (p.tension || 0);
                        if (diff !== 0) await changeTension(p, diff, "");
                    } else {
                        await changeTension(p, finalAmt, "");
                    }
                    continue;
                }

                // 文字代入（属性相性など）
                if (statKey.startsWith("aff_") || (mode === "set" && isNaN(Number(finalAmt)))) {
                    p[statKey] = finalAmt;
                    if (statKey === "hp") p.hp = Math.min(p.maxHp, Math.max(0, p.hp));
                }
                else if (mode === "recover" || mode === "set" || mode === "growth") {
                    updateCharStat(p, statKey, finalAmt, mode);
                    
                    // レベルアップと耐性上限が上がった時の後処理だけ残す
                    if (statKey === "exp_pool" && finalAmt > 0) {
                        await checkLevelUp(p); // 🌟 for...of にしたことで、順番に安全に処理される
                    } else if (["maxShock", "maxHeat", "maxElec"].includes(statKey) && mode === "growth") {
                        if (typeof initResistance === 'function') initResistance(p, true);
                    }
                }
            }
        } 

        if (step.msg) {
            changeView("view-story");
            const msgBox = document.getElementById("story-message-box");
            if (msgBox) msgBox.style.display = "block";
            document.getElementById("story-speaker").innerText = "システム";
            let displayAmt = Math.abs(finalAmt);
            let displayMsg = step.msg.replace(/\{amount\}/g, displayAmt);
            document.getElementById("story-text").innerText = await expandVariables(displayMsg);
            document.getElementById("story-aa").innerText = "";
            state.currentStepIndex++;
        } else {
            state.currentStepIndex++;
            await nextStory();
        }
    
    } else if (step.type === "job_change") {
        let targets = (!step.targetId || step.targetId.trim() === "") ? state.player : state.player.filter(p => p.id === step.targetId || p.originalId === step.targetId);
        let jobId = step.jobId;

        let jobData = null;
        if (window.customPlayerTeam) jobData = window.customPlayerTeam.find(c => c.id === jobId);
        if (!jobData && typeof INITIAL_PLAYER_TEAM !== 'undefined') jobData = INITIAL_PLAYER_TEAM.find(c => c.id === jobId);
        if (!jobData && typeof ENEMY_MASTER !== 'undefined') jobData = ENEMY_MASTER[jobId];

        if (!jobData) {
            showToast(`⚠️ エラー：指定されたジョブID「${jobId}」が見つかりません！`, "error");
        } else {
            targets.forEach(p => {
                // 1. 装備品を外して在庫に戻す（ロスト防止）
                let currentEquips = Array.isArray(p.equips) ? p.equips : (p.equip ? [p.equip] : []);
                currentEquips.forEach(eid => {
                    if (eid && eid !== "none") state.ownedEquips.push(eid);
                });
                p.equips = [];
                p.equip = null;

                // 2. 🌟 修正：SPの半減継承計算（GROW_MENUの全項目を動的に計算する）
                let totalUsedSp = 0;
                if (p.growStats) {
                    for (let key in p.growStats) {
                        const menuDef = typeof GROW_MENU !== 'undefined' ? GROW_MENU.find(m => m.key === key) : null;
                        if (menuDef) totalUsedSp += (p.growStats[key] * menuDef.cost);
                    }
                }
                let totalSp = (p.sp || 0) + totalUsedSp;
                let newSp = Math.floor(totalSp / 2); // 総SPの50%

                // 3. スキル（技）の保持
                let currentSkills = p.skills ? [...p.skills] : [];
                if (jobData.skills) {
                    jobData.skills.forEach(s => { if (!currentSkills.includes(s)) currentSkills.push(s); });
                }
                let currentEquipSkills = p.equipSkills ? [...p.equipSkills] : [];

                // 4. 🌟 修正：ベースステータスの完全上書き（限界値 limit_xxx も含む）
                Object.assign(p, JSON.parse(JSON.stringify(jobData)));

                // 5. 個別情報の再適用
                p.id = p.originalId || p.id;
                p.skills = currentSkills;
                p.equipSkills = currentEquipSkills;
                p.sp = newSp;
                p.growStats = {}; // 育成記録はリセット

                // 6. ハイドレーション（欠損値の穴埋め）
                if (typeof window.hydrateData === 'function') {
                    let hydrated = window.hydrateData({ player: [p] });
                    Object.assign(p, hydrated.player[0]);
                }

                // 7. 初期化
                p.level = 1;
                p.levelExp = 0;
                p.hp = p.maxHp;
                p.status = "none";
                p.statusTurn = 0;
                initResistance(p, true);
            });
            showToast(`✨ ジョブチェンジ完了！ (SPが半分継承されました)`, "success");
        }
        state.currentStepIndex++;
        await nextStory();

    } else if (step.type === "pass_time") {
        // 🌟 経過時間とメッセージに変数を適用
        let amount = Number(await expandVariables(String(step.amount))) || 1;
        advanceTime(amount);

        if (step.msg) {
            changeView("view-story");
            const msgBox = document.getElementById("story-message-box");
            if (msgBox) msgBox.style.display = "block";
            document.getElementById("story-speaker").innerText = "システム";
            document.getElementById("story-text").innerText = await expandVariables(step.msg);
            document.getElementById("story-aa").innerText = "";
        }

        state.currentStepIndex++;
        if (!step.msg) await nextStory();

    } else if (step.type === "craft") {
        saveGame();
        openCraft(step);
        return; // 🌟クラフト画面が終わるまで進行を止める

        // ▼ ここを追加！
    } else if (step.type === "bg_set") {
        state.customBg = (step.preset === "custom" ? step.custom_bg : step.preset);
        state.customTextColor = step.textColor;

        // 🌟 メッセージ枠の色設定を保存
        state.customMsgBg = step.msgBg;
        state.customMsgText = step.msgText;
        state.customMsgSpeaker = step.msgSpeaker;

        if (state.customBg === "auto" || !state.customBg) state.customBg = null;
        if (state.customTextColor === "auto" || !state.customTextColor) state.customTextColor = null;

        updateTimeUI();
        state.currentStepIndex++;
        await nextStory();

    } else if (step.type === "minigame") {
        saveGame();
        // アクション系（釣りなど）とカジノ系で呼び出す画面を分ける
        if (["gauge", "qte", "mash", "tetris"].includes(step.gameType)) {
            openActionGame(step);
        } else {
            openMinigame(step);
        }
        return;
    }
    else if (step.type === "jump") {
        jumpTo(step.next);

    } else if (step.type === "give") {
        let msg = "";
        let amtStr = await expandVariables(String(step.amount));
        let amt = Number(amtStr) || 1;

        if (ITEMS[step.target]) {
            const item = ITEMS[step.target];
            if (amt >= 0) {
                if (item.type === "consumable") {
                    let current = state.inventory[step.target] || 0;
                    let space = (state.maxItemCount > 0) ? Math.max(0, state.maxItemCount - current) : amt;
                    let actualAdd = Math.min(amt, space);

                    if (actualAdd > 0) {
                        state.inventory[step.target] = current + actualAdd;
                        msg = `${item.name} を ${actualAdd}個 手に入れた！`;
                    } else {
                        msg = `${item.name} は これ以上持てないようだ……`;
                    }
                } else {
                    for (let i = 0; i < amt; i++) state.ownedEquips.push(step.target);
                    msg = `${item.name} を ${amt}個 手に入れた！`;
                }
            } else {
                if (item.type === "consumable" && state.inventory[step.target]) {
                    state.inventory[step.target] = Math.max(0, state.inventory[step.target] + amt); // amtはマイナス値
                } else {
                    const removeCount = Math.abs(amt);
                    for (let i = 0; i < removeCount; i++) {
                        const idx = state.ownedEquips.indexOf(step.target);
                        if (idx !== -1) {
                            state.ownedEquips.splice(idx, 1);
                            for (let pChar of state.player) {
                                if (pChar.equip === step.target) { pChar.equip = null; break; }
                            }
                        }
                    }
                }
                msg = `${item.name} を 失った……`;
            }
        }

        if (msg) {
            changeView("view-story");
            const msgBox = document.getElementById("story-message-box");
            if (msgBox) msgBox.style.display = "block";
            document.getElementById("story-speaker").innerText = "システム";
            document.getElementById("story-text").innerText = await expandVariables(msg);
            document.getElementById("story-aa").innerText = "";
            state.currentStepIndex++;
        } else {
            state.currentStepIndex++;
            await nextStory();
        }
    } else if (step.type === "flag_set") {
        let val = step.flagValue;
        if (!isNaN(val) && val !== "") val = Number(val);
        else if (val === "true") val = true;
        else if (val === "false") val = false;

        let op = step.operator || "=";

        // 🌟 1. どの項目（現在値）に対しても使える「計算用関数」を定義
        const getNewValue = (current) => {
            if (op === "=") return val;
            let c = Number(current) || 0;
            let v = Number(val) || 0;
            if (op === "+=") return c + v;
            if (op === "-=") return c - v;
            if (op === "*=") return c * v;
            if (op === "/=") return Math.floor(c / (v || 1));
            return val;
        };

        // 🌟 2. 各項目に適用（newValを個別に計算しながら代入する）
        if (step.targetId) {
            let targetChars = state.player.filter(p => p.id === step.targetId || p.originalId === step.targetId);
            targetChars.forEach(tc => {
                tc[step.flagName] = getNewValue(tc[step.flagName]);
            });
        } else if (step.flagName === "day") {
            state.day = getNewValue(state.day); // ここでエラーが起きていた
            updateTimeUI();
        } else if (step.flagName === "timePeriod") {
            state.timePeriod = getNewValue(state.timePeriod);
            advanceTime(0);
        } else {
            let isGlobal = step.flagName.startsWith("G_");
            if (isGlobal) {
                let gf = await loadFromIndexedDB(STORE_GLOBAL, 'flags') || {};
                gf[step.flagName] = getNewValue(gf[step.flagName]);
                await saveToIndexedDB(STORE_GLOBAL, 'flags', gf);
            } else {
                state.flags[step.flagName] = getNewValue(state.flags[step.flagName]);
            }
        }

        // 🌟 追加：フラグ操作後は確実にセーブを走らせて状態を保全する
        saveGame();

        state.currentStepIndex++;
        await nextStory();
    }
    else if (step.type === "flag_check") {
        let isGlobal = step.flagName.startsWith("G_");
        let gf = isGlobal ? (await loadFromIndexedDB(STORE_GLOBAL, 'flags') || {}) : null;
        let isMatch = false; // 🌟 最初は false

        if (step.flagName === "day") {
            isMatch = checkCondition(state.day, step.condition, step.flagValue);
        } else if (step.flagName === "timePeriod") {
            isMatch = checkCondition(state.timePeriod, step.condition, step.flagValue);
        } else if (step.targetId) {
            // 🌟 修正：同種のキャラを全員取得し、「誰か1人でも」条件を満たせば true とする
            let targetChars = state.player.filter(p => p.id === step.targetId || p.originalId === step.targetId);
            if (targetChars.length > 0) {
                isMatch = targetChars.some(targetChar => {
                    let cVal = targetChar[step.flagName];
                    return checkCondition(cVal, step.condition, step.flagValue);
                });
            }
        } else {
            let cVal = isGlobal ? gf[step.flagName] : state.flags[step.flagName];
            isMatch = checkCondition(cVal, step.condition, step.flagValue);
        }

        if (isMatch) jumpTo(step.true_next);
        else jumpTo(step.false_next);

    }else if (step.type === "end") {
        let gf = await loadFromIndexedDB(STORE_GLOBAL, 'flags') || {};
        gf["G_CLEAR_COUNT"] = (Number(gf["G_CLEAR_COUNT"]) || 0) + 1;
        await saveToIndexedDB(STORE_GLOBAL, 'flags', gf);

        if (state.isTestPlay) {
            alert("テストプレイ終了（ENDノード到達）");
            state.isTestPlay = false;
            changeView("view-editor");
            return;
        }

        // 🌟 続行モード（そのまま続ける）
        if (step.clearMode === "keep") {
            // ユーザーへの説明を追加
            alert("【クリア後モード開始】\n物語の進行状況（フラグ）や時間はそのままに自由に冒険できます！");
            showToast("クリア後モード：続行中", "success");
            
            let nextScene = step.loopNext || "start";
            saveGame(true);
            jumpTo(nextScene);
            return;
        }


        if (step.clearMode === "loop") {
            // ユーザーへの説明を詳細化
            alert("【二周目：強くてニューゲーム開始】\n能力や装備を引き継ぎつつ、世界の状態（イベント進行）をリセットして最初から物語をやり直します！");
            
            // 引き継がないものをリセット
            if (!step.keepMoney) { state.money = 0; state.orbShinsei = 0; }
            if (!step.keepItems) { 
                // 🌟 修正：全消去する前に「👑 貴重品 (isGlobal)」だけを抽出して保護する
                let protectedInv = {};
                let protectedEqs = [];
                
                // 消費アイテムの保護
                Object.keys(state.inventory).forEach(itemId => {
                    if (ITEMS[itemId] && ITEMS[itemId].isGlobal) {
                        protectedInv[itemId] = state.inventory[itemId];
                    }
                });
                
                // 装備品の保護
                state.ownedEquips.forEach(eid => {
                    if (ITEMS[eid] && ITEMS[eid].isGlobal) {
                        protectedEqs.push(eid);
                    }
                });

                // 装備中（外されて消える予定）の装備品も、貴重品なら在庫に回収する
                state.player.forEach(p => {
                    let eqList = Array.isArray(p.equips) ? p.equips : (p.equip ? [p.equip] : []);
                    eqList.forEach(eid => {
                        if (eid && ITEMS[eid] && ITEMS[eid].isGlobal) {
                            protectedEqs.push(eid);
                        }
                    });
                });

                // リセットした上で、保護した貴重品だけを戻す
                state.inventory = protectedInv; 
                state.ownedEquips = protectedEqs; 
            }

            if (!step.keepChars) {
                let sourceTeam = (window.customPlayerTeam !== null && window.customPlayerTeam.length > 0) ? window.customPlayerTeam : INITIAL_PLAYER_TEAM;
                state.player = [JSON.parse(JSON.stringify(sourceTeam[0]))];
                state.player.forEach(p => p.originalId = p.id);
            } else {
                // キャラを引き継ぐ場合でも、全回復＆状態異常・戦闘フラグはリセットする
                state.player.forEach(p => {
                    p.hp = p.maxHp; p.mp = p.maxMp; p.st = p.maxSt;
                    cleanUpCharacterBattleFlags(p); 
                });
            }
            
            // 進行フラグ・日数は無条件でリセット（グローバルは維持）
            state.flags = {};
            state.day = 1; state.timePeriod = 1;
            
            // ゴーストやバトルのゴミを掃除
            state.enemy = [];
            state.inBattle = false; state.isPrepPhase = false; state.partyBattle = null; state.tacData = null;
            
            // 🌟 loopNext は、keepと共通のジャンプ先として扱う
            let nextScene = step.loopNext || "start";
            saveGame(true); // 周回用データとして上書き保存
            jumpTo(nextScene);
            return;
        }

        // 🌟 従来モード（セーブデータを削除してタイトルへ）
        alert("🎉 ゲームクリア！おめでとうございます！");
        await deleteFromIndexedDB(STORE_SAVE, 'slot1');
        await checkSaveData();
        cleanupGameState();
        changeView("view-title");
    }

    resizeAllAAs(); 
}

window.rollStoryDice = async function () {
    const step = SCENARIO[state.currentSceneId][state.currentStepIndex];
    const rollBtn = document.getElementById("btn-roll-story");
    rollBtn.style.display = "none";
    const valEl = document.getElementById("story-dice-val");
    let roll = 0;

    // 🌟 修正：保存しておいた変数展開済みの最大値を使用する
    let diceMax = state.currentStoryDiceMax || 100;

    for (let i = 0; i < 15; i++) {
        roll = Math.floor(Math.random() * diceMax) + 1;
        valEl.innerText = roll;
        await wait(150);
    }
    await wait(1000);
    document.getElementById("story-dice-area").style.display = "none";
    let nextScene = step.options[step.options.length - 1].next;
    for (let opt of step.options) { if (roll >= opt.min && roll <= opt.max) { nextScene = opt.next; break; } }
    state.isWaitingChoice = false; jumpTo(nextScene);
}

let currentShopMode = 'buy';
let currentShopItems = [];

function openShop() {
    changeView("view-shop");

    const step = SCENARIO[state.currentSceneId][state.currentStepIndex];
    let items = step.items || [];

    // 🌟 修正：空欄なら、価格が1G以上設定されている（売る前提の）全アイテムを表示
    if (items.length === 0 && typeof ITEMS !== 'undefined') {
        items = Object.keys(ITEMS).filter(id => ITEMS[id] && ITEMS[id].price > 0);
    }

    currentShopItems = items;
    switchShopTab('buy');
}


window.switchShopTab = async function (mode) {
    currentShopMode = mode;
    document.getElementById("shop-money").innerText = state.money;

    const tabBuy = document.getElementById("tab-buy");
    const tabSell = document.getElementById("tab-sell");
    const title = document.getElementById("shop-title");

    let htmls = [];

    if (mode === 'buy') {
        tabBuy.className = "btn-primary w-100"; tabSell.className = "btn-cancel w-100";
        title.innerText = "💰 道具屋（かう）";

        // ▼ for...of ループにして await を使えるようにする
        for (const rawId of currentShopItems) {

            // 🌟追加：限定品のフラグ条件チェック (例: "heal_1:affection_yaruo>=50")
            let id = rawId;
            let conditionStr = "";
            if (rawId.includes(":")) {
                const parts = rawId.split(":");
                id = parts[0].trim();
                conditionStr = parts[1].trim();
            }

            const item = ITEMS[id];
            if (!item) continue;

            // 🌟追加：条件式が書かれていたら、フラグを満たしているかチェックする
            if (conditionStr) {
                const match = conditionStr.match(/([a-zA-Z0-9_]+)(==|>=|<=|!=|>|<)(.+)/);
                if (match) {
                    const fName = match[1]; const cond = match[2]; const fValTarget = match[3];
                    let currentVal = 0;

                    // グローバルフラグか、進行フラグか、キャラ変数かを特定して値を取る
                    if (fName.startsWith("G_")) {
                        const gf = await loadFromIndexedDB(STORE_GLOBAL, 'flags') || {};
                        currentVal = gf[fName] || 0;
                    } else if (state.flags[fName] !== undefined) {
                        currentVal = state.flags[fName];
                    } else {
                        // 進行フラグになければキャラ変数を探す
                        let foundInChar = false;
                        for (let p of state.player) { if (p[fName] !== undefined) { currentVal = p[fName]; foundInChar = true; break; } }
                        if (!foundInChar) currentVal = 0; // どこにも無いなら0
                    }

                    // 数値比較
                    let cV = Number(currentVal), tV = Number(fValTarget);
                    if (isNaN(cV) || isNaN(tV)) { cV = String(currentVal); tV = String(fValTarget); }

                    let isMatch = false;
                    if (cond === "==") isMatch = (cV == tV);
                    else if (cond === "!=") isMatch = (cV != tV);
                    else if (cond === ">=") isMatch = (cV >= tV);
                    else if (cond === "<=") isMatch = (cV <= tV);
                    else if (cond === ">") isMatch = (cV > tV);
                    else if (cond === "<") isMatch = (cV < tV);

                    // 条件を満たしていなければ、店に並べない（スキップする）
                    if (!isMatch) continue;
                }
            }
            const isOwned = item.type === "equip" && state.ownedEquips.includes(id);
            const btnText = isOwned ? "所持済" : `${item.price} G`;
            const btnAttr = isOwned ? "disabled" : `onclick="buyItem('${id}')"`;
            const statText = getEquipStatText(item);

            const resolvedAA = await resolveAA(item.aa); // ◀ [object Promise] を防ぐ

            htmls.push(`<div class="prep-char-card"><div class="item-aa-box" style="margin-right:10px;"><pre class="item-aa" style="font-size:10px;">${resolvedAA}</pre></div><div style="flex:1"><b>${item.name}</b> ${statText}<br><small>${item.desc}</small></div><button class="cmd-btn" style="min-width:70px;" ${btnAttr}>${btnText}</button></div>`);
        }
        document.getElementById("shop-list").innerHTML = htmls.join("");

    } else {
        tabSell.className = "btn-primary w-100"; tabBuy.className = "btn-cancel w-100";
        title.innerText = "⚖️ 道具屋（うる）";

        // 消費アイテムの売却リスト
        for (const id of Object.keys(state.inventory)) {
            const count = state.inventory[id];
            if (count > 0) {
                const item = ITEMS[id];
                const sellPrice = Math.floor(item.price / 2);
                const resolvedAA = await resolveAA(item.aa);
                htmls.push(`<div class="prep-char-card"><div class="item-aa-box" style="margin-right:10px;"><pre class="item-aa" style="font-size:10px;">${resolvedAA}</pre></div><div style="flex:1"><b>${item.name}</b> (残${count})<br><small>売値: ${sellPrice} G</small></div><button class="cmd-btn" style="min-width:70px;" onclick="sellItem('${id}', 'consumable', ${sellPrice})">売る</button></div>`);
            }
        }

        // 🌟 装備品の売却リスト（ここを修正）
        // かばんの中にある装備をカウントする
        let bagCounts = {};
        state.ownedEquips.forEach(eid => { bagCounts[eid] = (bagCounts[eid] || 0) + 1; });

        for (const id of Object.keys(bagCounts)) {
            const item = ITEMS[id];
            if (!item) continue;
            const count = bagCounts[id];
            const sellPrice = Math.floor(item.price / 2);
            const resolvedAA = await resolveAA(item.aa);
            const statText = getEquipStatText(item);

            // sellItemAt の引数を id に変更
            htmls.push(`<div class="prep-char-card"><div class="item-aa-box" style="margin-right:10px;"><pre class="item-aa" style="font-size:10px;">${resolvedAA}</pre></div><div style="flex:1"><b>${item.name}</b> ${statText}<br><small>売値: ${sellPrice} G (所持数:${count})</small></div><button class="cmd-btn" style="min-width:70px;" onclick="sellItemAt('${id}', ${sellPrice})">売る</button></div>`);
        }

        if (htmls.length === 0) htmls.push("<div style='text-align:center; color:#718096; padding:20px;'>売れるものがないようだ……</div>");
        document.getElementById("shop-list").innerHTML = htmls.join("");
    }
};



window.buyItem = function (id) {
    const item = ITEMS[id];
    if (!item) return;

    // 購入可能か最終チェック
    if (state.money < item.price) {
        alert("Gが足りないお！");
        return;
    }

    if (item.type === "consumable" && state.maxItemCount > 0) {
        if ((state.inventory[id] || 0) >= state.maxItemCount) {
            alert(`これ以上 ${item.name} は持てないお！`);
            return;
        }
    }

    // 金額を減らす（マイナスにならないようガード）
    state.money = Math.max(0, state.money - item.price);

    if (item.type === "consumable") state.inventory[id] = (state.inventory[id] || 0) + 1;
    else state.ownedEquips.push(id);

    sysLog(`[ショップ] ${item.name} 購入`);
    saveGame();
    switchShopTab('buy');
};

window.sellItem = function (id, type, price) {
    const item = ITEMS[id];
    // ▼ 在庫がゼロ以下の場合は強制終了（お金増殖防止）
    if (type === "consumable" && (state.inventory[id] || 0) <= 0) return;

    if (confirm(`${item.name} を ${price} G で売りますか？`)) {
        state.money = Math.min(99999999, state.money + price);
        
        // 🌟 修正：売却して0個になったら完全に抹消
        state.inventory[id]--;
        if (state.inventory[id] <= 0) {
            delete state.inventory[id];
        }

        sysLog(`[ショップ] ${item.name} 売却`);
        saveGame();
        switchShopTab('sell');
    }
};
// 🌟 修正：第1引数を idx (番号) から id (アイテムID) に変更
window.sellItemAt = function (id, price) {
    const item = ITEMS[id];
    if (!item) return;

    if (confirm(`${item.name} を ${price} G で売りますか？\n（※現在誰かが装備中のものは含まれません）`)) {
        // 🌟 かばんの中から対象のIDを1つだけ探して削除する
        const targetIdx = state.ownedEquips.indexOf(id);
        
        if (targetIdx !== -1) {
            state.ownedEquips.splice(targetIdx, 1); // かばんから1つ消す
            state.money = Math.min(99999999, state.money + price); // お金を増やす

            sysLog(`[ショップ] ${item.name} を売却しました`);
            saveGame();
            switchShopTab('sell'); // 画面を更新
        } else {
            alert("エラー：かばんの中にそのアイテムがありませんお！");
        }
    }
};
window.leaveShop = function () {
    state.currentStepIndex++;
    saveGame();
    nextStory();
};

window.updatePrepUI = function() {
    let currentMax = state.maxEquipCount || 1;
    state.player.forEach(p => {
        if (Array.isArray(p.equips) && p.equips.length > currentMax) {
            let overEquips = p.equips.slice(currentMax);
            let hasRemoved = false;
            overEquips.forEach(eid => {
                if (eid && eid !== "none") {
                    state.ownedEquips.push(eid);
                    hasRemoved = true;
                }
            });
            p.equips = p.equips.slice(0, currentMax);
            if (hasRemoved) {
                showToast(`⚠️ ${p.name} の装備枠減少により、はみ出た装備を回収しました`, "warning");
            }
        }
    });

    document.getElementById("prep-enemy-list").innerHTML = state.enemy.map(e => `<div class="prep-enemy-card">${e.name}</div>`).join("");

    // 🌟 修正：パーティバトルとタイマン(1vs1)で表示人数と機能を分ける
    const memberLimit = state.enablePartyBattle ? (state.battleMemberCount || 3) : 8; // タイマン時は同行枠(8人)全員から選べるようにする

    document.getElementById("prep-player-list").innerHTML = state.player.map((p, i) => {
        // 表示限界、もしくは死んでいるキャラは表示しない
        if (p.hp <= 0 || i >= memberLimit) return "";

        // --- 1. 装備品セレクト（複数枠）の生成 ---
        if (!p.equips) p.equips = p.equip ? [p.equip] :[]; 
        let maxEq = state.maxEquipCount || 1;
        let equipUI = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;

        for (let s = 0; s < maxEq; s++) {
            let opts = `<option value="none">-- 装備なし --</option>`;
            
            // 🌟 修正：かばんの中身 ＋ 今このスロットに着けているものを合算してリストを作る
            let availableEquips = [...state.ownedEquips];
            if (p.equips[s] && p.equips[s] !== "none") {
                availableEquips.push(p.equips[s]);
            }

            let equipCounts = {};
            availableEquips.forEach(eid => equipCounts[eid] = (equipCounts[eid] || 0) + 1);

            Object.keys(equipCounts).forEach(eid => {
                let myOtherSlotsCount = p.equips.filter((e, eIdx) => eIdx !== s && e === eid).length;
                let isBlockedByRule = (!state.enableMultiEquip && myOtherSlotsCount > 0);

                if (!isBlockedByRule || p.equips[s] === eid) {
                    const item = ITEMS[eid];
                    if (item) {
                        let statPlain = getEquipStatText(item).replace(/<[^>]*>?/gm, '');
                        opts += `<option value="${eid}" ${p.equips[s] === eid ? 'selected' : ''}>${item.name} ${statPlain} (残${equipCounts[eid]})</option>`;
                    }
                }
            });
            equipUI += `<select style="font-size:11px; padding:2px;" onchange="changeEquip(${i}, ${s}, this.value)">${opts}</select>`;
        }
        equipUI += `</div>`;

        // --- 2. 技の装備スロットUIの生成 ---
        let skillUI = "";
        if (state.maxSkills > 0 && p.skills && p.skills.length > 0) {
            if (!p.equipSkills) p.equipSkills = p.skills.slice(0, state.maxSkills);

            skillUI = `<div style="margin-top:8px; font-size:11px; font-weight:bold; color:var(--primary);">⚔️ 装備技スロット (最大${state.maxSkills}):</div>
                       <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:2px;">`;

            for (let s = 0; s < state.maxSkills; s++) {
                let sOpts = `<option value="none">----</option>`;
                p.skills.forEach(sid => {
                    const sk = SKILLS[sid] || { name: sid };
                    sOpts += `<option value="${sid}" ${p.equipSkills[s] === sid ? 'selected' : ''}>${sk.name}</option>`;
                });
                skillUI += `<select style="font-size:10px; padding:2px; height:24px;" onchange="changeEquipSkill(${i}, ${s}, this.value)">${sOpts}</select>`;
            }
            skillUI += `</div>`;
        }

        // --- 3. 育成ボタンとアクションボタンのスタイル ---
        const sp = p.sp || 0;
        const growBtnStyle = sp > 0 ? "background: var(--warning); border-color: var(--warning-dark); color: #000; animation: blink 2s infinite;" : "";
        const growBtnText = sp > 0 ? `★育成 (SP:${sp})` : `育成 (SP:0)`;

        let actionBtnHtml = "";
        let isActiveClass = "";

        if (state.enablePartyBattle) {
            // 🌟 パーティバトル時：陣形（並び順）入れ替えボタンを表示
            let upDisabled = (i === 0) ? "disabled style='opacity:0.3;'" : "";
            let downDisabled = (i === memberLimit - 1 || i === state.player.length - 1 || (state.player[i+1] && state.player[i+1].hp <= 0)) ? "disabled style='opacity:0.3;'" : "";
            
            // 配置の名称（スロット番号）をつける
            let slotName = `配置 ${i + 1}`;

            actionBtnHtml = `
                <div style="font-size:10px; color:var(--primary); font-weight:bold; text-align:center; margin-bottom:2px;">${slotName}</div>
                <div style="display:flex; gap:2px; margin-bottom:4px;">
                    <button class="btn-custom btn-sm" style="flex:1; padding:4px;" onclick="movePrepOrder(${i}, -1)" ${upDisabled}>▲</button>
                    <button class="btn-custom btn-sm" style="flex:1; padding:4px;" onclick="movePrepOrder(${i}, 1)" ${downDisabled}>▼</button>
                </div>
            `;
        } else {
            // 🌟 タイマン(1vs1)時：先発選択ボタンを表示
            const btnText = (i === state.activeP) ? '先発中' : '先発にする';
            const btnAttr = (i === state.activeP) ? 'disabled' : `onclick="setFront(${i})"`;
            actionBtnHtml = `<button class="cmd-btn" style="margin-bottom:4px;" ${btnAttr}>${btnText}</button>`;
            isActiveClass = (i === state.activeP) ? 'active-char' : '';
        }

        const pStats = getStats(p, true);
        const traitName = typeof TRAITS !== 'undefined' && TRAITS[p.trait] ? TRAITS[p.trait].name : "なし";

        // --- 4. 最終的なHTML組み立て ---
        return `
        <div class="prep-char-card ${isActiveClass}">
            <div style="flex:1">
                <div style="margin-bottom:4px;">
                    <b>${p.name}</b> <span class="lv">Lv.${p.level}</span>
                </div>
                <div style="font-size:12px; margin-bottom:6px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <span style="color:#e53e3e; font-weight:bold;">HP:${p.hp}/${p.maxHp}</span>
                    <span style="color:#2b6cb0; font-weight:bold;">技:${pStats.tech}</span>
                    <span style="color:#38a169; font-weight:bold;">経:${pStats.exp}</span>
                    <span style="background:#edf2f7; color:#553c9a; padding:1px 6px; border-radius:4px; font-size:10px; border:1px solid #d6bcfa;">
                        特性: ${traitName}
                    </span>
                </div>
                <div style="font-size:11px; font-weight:bold; color:#4a5568;">🗡️ 装備品:</div>
                ${equipUI}
                ${skillUI} 
            </div>
            <div style="display:flex; flex-direction:column; gap:2px; margin-left:10px; justify-content:center; min-width:80px;">
                ${actionBtnHtml}
                <button class="cmd-btn" style="${growBtnStyle}" onclick="openGrowModal(${i})">${growBtnText}</button>
            </div>
        </div>`;
    }).join("");
};

window.setFront = (i) => { state.activeP = i; updatePrepUI(); };
window.changeEquip = (pi, slot, eid) => {
    let p = state.player[pi];
    if (!p.equips) p.equips = p.equip ? [p.equip] :[];

    // 🌟 修正：今装備しているものをかばんに戻す
    let oldEquip = p.equips[slot];
    if (oldEquip && oldEquip !== "none") state.ownedEquips.push(oldEquip);

    // 🌟 修正：新しく着けるものをかばんから減らす
    if (eid !== "none") {
        let idx = state.ownedEquips.indexOf(eid);
        if (idx !== -1) state.ownedEquips.splice(idx, 1);
    }

    // 重複装備禁止ルール（スロット間の移動処理）
    if (!state.enableMultiEquip && eid !== "none") {
        for (let i = 0; i < (state.maxEquipCount || 1); i++) {
            if (i !== slot && p.equips[i] === eid) {
                state.ownedEquips.push(eid); // 古いスロットの分をかばんに戻す
                p.equips[i] = null;
            }
        }
    }

    p.equips[slot] = (eid === "none") ? null : eid;
    updatePrepUI();
};

window.changeEquipInCamp = function (pi, slot, eid) {
    let p = state.player[pi];
    if (!p.equips) p.equips = p.equip ? [p.equip] : [];

    let oldEquip = p.equips[slot];
    if (oldEquip && oldEquip !== "none") state.ownedEquips.push(oldEquip);

    if (eid !== "none") {
        let idx = state.ownedEquips.indexOf(eid);
        if (idx !== -1) state.ownedEquips.splice(idx, 1);
    }

    if (!state.enableMultiEquip && eid !== "none") {
        for (let i = 0; i < (state.maxEquipCount || 1); i++) {
            if (i !== slot && p.equips[i] === eid) {
                state.ownedEquips.push(eid);
                p.equips[i] = null;
            }
        }
    }

    p.equips[slot] = (eid === "none") ? null : eid;
    renderGrowModal();
    appendEquipChangeButton(pi);
    showToast("装備を変更したお！", "info");
};
window.finishPrep = () => { 
    if (state.player[state.activeP].hp <= 0) { 
        let aliveIdx = state.player.findIndex(x => x.hp > 0);
        state.activeP = aliveIdx !== -1 ? aliveIdx : 0; 
    } 

    // 🌟 修正：Viewの切り替えとフラグ更新をこの順番で行う
    state.isPrepPhase = false; // 準備完了
    state.inBattle = true;     // バトル本番フラグON
    
    saveGame(); 
    
    // 🌟 追加：準備画面を一度消去して、バトルの開始処理(nextStory)を呼び直す
    document.getElementById("view-prep").classList.remove("active");
    nextStory(); 
};

// 🌟 追加：戦闘準備画面での並び替え関数
window.movePrepOrder = function(index, dir) {
    const memberLimit = state.battleMemberCount || 3;
    const newIndex = index + dir;

    // 範囲外の移動は不可
    if (newIndex < 0 || newIndex >= memberLimit || newIndex >= state.player.length) {
        return;
    }
    
    // 生存しているメンバー同士の入れ替えのみ許可する
    if (state.player[newIndex].hp <= 0) {
        return;
    }

    let temp = state.player[index];
    state.player[index] = state.player[newIndex];
    state.player[newIndex] = temp;

    updatePrepUI();
};
window.processSingleCharTurnEnd = async function (c, isPlayer) {
    if (!c || c.hp <= 0) return;

    let sMsg = "";

    // ① 状態異常のダメージ処理（ダメージ自体は毎ターン発生させてOK）
    if (c.status && c.status !== "none") {
        if (c.status === "poison") {
            let d = Math.max(1, Math.floor(c.maxHp * 0.1));
            c.hp = Math.max(0, c.hp - d);
            sMsg = `猛毒で ${d} のダメージ！`;
        } else if (c.status === "burn") {
            c.hp = Math.max(0, c.hp - 20);
            sMsg = `火傷で 20 のダメージ！`;
        } else if (c.status === "deadly_poison" && state.enableResistance) {
            c.curShock = Math.max(0, c.curShock - Math.floor(c.maxShock * 0.1));
            c.curHeat = Math.max(0, c.curHeat - Math.floor(c.maxHeat * 0.1));
            c.curElec = Math.max(0, c.curElec - Math.floor(c.maxElec * 0.1));
            sMsg = `劇毒で 耐性が減少した！`;
        } else if (c.status === "blaze" && state.enableResistance) {
            c.curShock = Math.max(0, c.curShock - 10);
            c.curHeat = Math.max(0, c.curHeat - 10);
            c.curElec = Math.max(0, c.curElec - 10);
            sMsg = `炎上で 耐性が減少した！`;
        }
if (sMsg) { 
            if (c.hp <= 0) c.tempEmotion = "ダメージ"; 
            await showMsg(`${c.name} は ${sMsg}`); 
            await updateUI(); 
            await wait(800); 
        }

        // 🌟 修正：付与されたターンと現在のターンが異なる場合のみカウントを減らす
        if (c.statusAppliedTurn !== state.turnCount) {
            c.statusTurn--;
        }

        // 自然治癒判定
        if (c.statusTurn <= 0) {
            if (c.status === "doom") {
                c.hp = 0; c.status = "none";
                await showMsg(`<span style="color:#e53e3e;">【破滅】の時が来た……！ ${c.name} は 息絶えた！</span>`);
                playGlitchEffect(); await wait(1500);
            } else {
                c.status = "none";
                await showMsg(`${c.name} の 状態異常が 治った！`);
                await updateUI(); await wait(800);
            }
        }
    }

    // ② 自動回復処理
    if (c.hp > 0 && c.hp < c.maxHp) {
        if (c.trait === "regeneration") {
            c.hp = c.maxHp;
            await showMsg(`【さいせい】 ${c.name} の体力が 全回復した！`); await updateUI(); await wait(800);
        } else if (c.trait === "auto_heal") {
            let healAmount = Math.max(1, Math.floor(c.maxHp * 0.1));
            c.hp = Math.min(c.maxHp, c.hp + healAmount);
            await showMsg(`【自動回復】 ${c.name} の体力が ${healAmount} 回復した！`); await updateUI(); await wait(800);
        }
    }

    // 🌟 追加：MPとSTの自然回復処理（毎ターン最大値の10%を回復）
    if (state.enableMpSt && c.hp > 0) {
        let mpHeal = Math.max(1, Math.floor(c.maxMp * 0.10));
        let stHeal = Math.max(1, Math.floor(c.maxSt * 0.10));
        
        // 特殊な状態異常による回復阻害
        if (c.status === "aging") { 
            mpHeal = Math.floor(mpHeal / 2); 
            stHeal = Math.floor(stHeal / 2); 
        }

        c.mp = Math.min(c.maxMp, c.mp + mpHeal);
        c.st = Math.min(c.maxSt, c.st + stHeal);
        // ※ 毎ターン全員の回復メッセージを出すとテンポが悪くなるため、裏側でのみ加算します
    }

    // ③ 戦闘フラグのカウント進行
    if (c.hp > 0) {
        c.turnInBattle = (c.turnInBattle || 0) + 1;
        processResTurnEnd(c, isPlayer); // 🌟 耐性の回復もここで呼ぶ！
    }

    c.isFirstTurn = false;
    if (c.rechargeTurn > 0) c.rechargeTurn--;
};
window.getAliveTarget = function (isTargetingPlayer, rule = "random") {
    // 狙う対象のチームを取得（前衛のみ）
    let team = isTargetingPlayer
        ? state.player.slice(0, state.battleMemberCount || 3)
        : state.enemy;

    // 生きているキャラだけを抽出
    let aliveChars = team.filter(c => c && c.hp > 0);
    if (aliveChars.length === 0) return null;

    // 🌟 ルール別の選定
    if (rule === "weakest") {
        // 一番HPが低いキャラを狙う（暗殺）
        return aliveChars.reduce((prev, curr) => (prev.hp < curr.hp) ? prev : curr);
    }
    else {
        // ランダムに選ぶ（通常・フォールバック）
        // ※ PvP中は乱数ズレを防ぐため、常に先頭を狙う仕様を組み込む
        if (state.isPvP && isTargetingPlayer) {
            return aliveChars[0];
        }
        return aliveChars[Math.floor(Math.random() * aliveChars.length)];
    }
};
// ==========================================
// 🎨 UI共通化：キャラクターカードのHTML生成
// ==========================================
// mode: "prep"(準備/リザルト), "party"(3vs3戦闘), "tactical"(盤面ステータス)
window.generateCharCardHTML = async function (char, mode, extraData = {}) {
    extraData = extraData || {};
    if (!char) return "";

    const isPlayer = state.player.includes(char);
    const stats = getStats(char, isPlayer);
    const hpPer = (char.hp / char.maxHp * 100).toFixed(1);
    const traitName = TRAITS[char.trait]?.name || "なし";
    const traitDesc = TRAITS[char.trait]?.desc || "特に効果はない";

    // 共通の特性ラベル（ツールチップ付き）を作成
    const traitLabelHtml = `
    <div class="tooltip-container" style="display:inline-block;">
        <span style="background:#edf2f7; color:#553c9a; padding:1px 6px; border-radius:4px; font-size:9px; font-weight:bold; border:1px solid #d6bcfa;">
            特: ${traitName}
        </span>
        <div class="tooltip-text" style="font-weight:normal; color:#e2e8f0;">${traitDesc}</div>
    </div>`;
    // 共通の表示パーツを取得
    let faceAA = await getFace(char);
    let resHtml = getMiniResBars(char, isPlayer);
    let attrHtml = getAffinityIcons(char); // 属性相性（装備込み）
    let statusHtml = getStatusIcon(char);  // 状態異常バッジ

    // --- 1. パーティバトル中のカード表示 ---
    if (mode === "party") {
        let isActive = extraData.isActive ? "active-turn" : "";
        let isReady = (!isActive && extraData.isReady) ? "ready-turn" : "";
        let isDead = char.hp <= 0 ? "dead" : "";

        // スポットライト演出（攻撃者や対象を強調）
        let spotlightClass = "";
        if (state.partyBattle && state.partyBattle.focusAttackerId) {
            if (char.id === state.partyBattle.focusAttackerId) {
                spotlightClass = "attacker-focus";
            } else if (state.partyBattle.focusTargetIds && state.partyBattle.focusTargetIds.includes(char.id)) {
                spotlightClass = state.partyBattle.isSupportFocus ? "support-focus" : "target-focus";
            } else {
                spotlightClass = "dimmed";
            }
        }

        let tenHtml = (state.enableTension && char.tension !== 0) ?
            `<div style="font-size:10px; color:#dd6b20; font-weight:bold; text-align:center; margin-bottom:2px;">🔥テンション:${char.tension}</div>` : "";

        let sidePrefix = isPlayer ? "p" : "e";
        
        // 🌟 修正：行動順(actOrder)が不明でも、キャラがダイス目(turnDice)を持っていれば必ずバッジを表示する！
        let hasDice = (extraData.turnDice !== null && extraData.turnDice !== undefined) || (char.turnDice !== undefined);
        let displayDice = extraData.turnDice || char.turnDice;
        let badgeClass = extraData.actOrder > 0 ? `order-${extraData.actOrder}` : "order-1"; // 順番が不明な時はデフォルトの色にする

        let orderHtml = hasDice 
            ? `<div id="${sidePrefix}-order-${extraData.idx}" class="p-order-badge ${badgeClass}">${displayDice}</div>` 
            : `<div id="${sidePrefix}-order-${extraData.idx}" class="p-order-badge" style="display:none;"></div>`;

        let traitHtml = `<div style="text-align:center; margin-bottom:2px;">${traitLabelHtml}</div>`;

        // 🌟 追加：パーティーバトルでもステータス（技・経・攻・防）と装備を表示する
        let pStatsHtml = `
            <div style="font-size:9px; margin-bottom:2px; text-align:center; color:#2d3748; font-weight:bold; white-space:nowrap; letter-spacing:-0.5px;">
                <span style="color:#2b6cb0">技:${stats.tech}</span> <span style="color:#38a169">経:${stats.exp}</span> 攻:${stats.dmg + Math.floor(stats.tech / 10)} 防:${stats.def + Math.floor(stats.exp / 10)}
            </div>`;
            
        let eqList = Array.isArray(char.equips) ? char.equips : (char.equip ? [char.equip] :[]);
        let eqNames = eqList.map(eid => (eid && ITEMS[eid]) ? ITEMS[eid].name : "").filter(n => n).join("/");
        if (!eqNames) eqNames = "なし";
        let equipHtml = `<div style="font-size:9px; text-align:center; color:#4a5568; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;">装: ${eqNames}</div>`;

        // 🌟 追加：システムがONの時だけMP/STバーのHTMLを組み立てる
        let mpStHtml = "";
        if (state.enableMpSt) {
            let mpPer = char.maxMp > 0 ? (char.mp / char.maxMp * 100) : 0;
            let stPer = char.maxSt > 0 ? (char.st / char.maxSt * 100) : 0;
            const valStyle = `position:absolute; width:100%; text-align:center; font-size:8px; font-weight:bold; color:#fff; text-shadow:1px 1px 1px #000; line-height:8px; top:0; left:0; pointer-events:none;`;
            mpStHtml = `
                <div style="display:flex; gap:6px; height:12px; align-items:center; margin-bottom:1px; padding:0 4px;">
                    <div style="flex:1; display:flex; align-items:center; gap:2px;">
                        <span style="font-size:8px; color:#9f7aea; font-weight:bold;">M</span>
                        <div class="p-bar-wrap" style="height:8px; flex:1; margin:0; position:relative; background:#1a202c; border-radius:3px; overflow:hidden; border:1px solid #000;">
                            <div class="p-bar-fill" style="background:#9f7aea; width:${mpPer}%; height:100%;"></div>
                            <span style="${valStyle}">${Math.floor(char.mp)}</span>
                        </div>
                    </div>
                    <div style="flex:1; display:flex; align-items:center; gap:2px;">
                        <span style="font-size:8px; color:#ed8936; font-weight:bold;">S</span>
                        <div class="p-bar-wrap" style="height:8px; flex:1; margin:0; position:relative; background:#1a202c; border-radius:3px; overflow:hidden; border:1px solid #000;">
                            <div class="p-bar-fill" style="background:#ed8936; width:${stPer}%; height:100%;"></div>
                            <span style="${valStyle}">${Math.floor(char.st)}</span>
                        </div>
                    </div>
                </div>`;
        }

        // 🌟 修正：組み立てた pStatsHtml と equipHtml を return 文の中に組み込む
        return `
        <div id="card-${char.id}" class="p-battler ${isActive} ${isReady} ${isDead} ${spotlightClass}" onclick="selectActor(${extraData.idx})">
            ${orderHtml}
            <div id="popup-${char.id}" style="display:none;"></div>
            <div class="p-name">${char.name}</div>
            <!-- 🌟 修正：IDを付与してリサイズ関数が捕捉できるようにする -->
            <div class="p-aa" id="card-aa-box-${char.id}"><pre id="card-aa-pre-${char.id}">${faceAA}</pre></div>
            <div class="p-status" style="display:flex; flex-direction:column; min-height:100px;">
                ${statusHtml}${tenHtml}${traitHtml}
                ${pStatsHtml} <!-- 🌟 ここに追加 -->
                ${equipHtml}  <!-- 🌟 ここに追加 -->
                <div class="p-bar-wrap"><div class="p-bar-fill js-hp-bar" style="background:var(--c-hp); width:${hpPer}%;"></div></div>
                <span class="p-val-text">${char.hp}/${char.maxHp}</span>
                ${mpStHtml} <!-- 🌟 ここに挿入 -->
                ${resHtml}
                <div style="margin-top:auto;">${attrHtml}</div>
            </div>
        </div>`;
    }
    
    // --- 2. 準備画面・リザルト画面のカード表示 ---
    else if (mode === "prep" || mode === "result") {
        let isActiveChar = extraData.isActiveChar ? "active-char" : "";
        let btnHtml = extraData.btnHtml || "";
        let equipHtml = extraData.equipHtml || "";

        return `
        <div class="prep-char-card ${isActiveChar}" style="display:flex; align-items:flex-end; gap:10px; min-height:120px;">
            <!-- 左側：AA表示 -->
            <div class="p-aa" style="width:80px; height:80px; flex-shrink:0; background:rgba(0,0,0,0.05); border-radius:8px; overflow:hidden;">
                <pre style="font-size: clamp(4px, 1.5vw, 8px) !important;">${faceAA}</pre>
            </div>
            
            <!-- 中央：ステータス情報 -->
            <div style="flex:1; display:flex; flex-direction:column; height:100%;">
                <div style="margin-bottom:4px;">
                    <b style="font-size:16px;">${char.name}</b> <span class="lv">Lv.${char.level}</span>
                </div>
                <div style="font-size:11px; margin-bottom:4px; display:flex; flex-wrap:wrap; gap:5px;">
                    <span style="color:#e53e3e; font-weight:bold;">HP:${char.hp}/${char.maxHp}</span>
                    <span style="color:#2b6cb0; font-weight:bold;">技:${stats.tech}</span>
                    <span style="color:#38a169; font-weight:bold;">経:${stats.exp}</span>
                </div>

                <!-- 🌟 ここを以下の3行に書き換える -->
                <div style="margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                    ${traitLabelHtml} ${statusHtml}
                </div>

                ${equipHtml}
                
                <!-- 🌟 準備/リザルト画面でも属性相性を表示 -->
                <div style="margin-top:auto; padding-top:5px;">
                    ${attrHtml}
                </div>
            </div>
            
            <!-- 右側：ボタン類 -->
            <div style="display:flex; flex-direction:column; gap:5px; justify-content:center;">
                ${btnHtml}
            </div>
        </div>`;
    }
    return "";
};
function getStats(c, isPlayer = false, opponentTrait = "none", includeTempBuff = true) {
    let t = Math.min(100, c.tech || 0);
    let e = Math.min(100, c.exp || 0);
    let d = c.baseDmg || 0, def = c.baseDef || 0;

    let aS = c.atkShock || 0, aH = c.atkHeat || 0, aE = c.atkElec || 0;
    let mS = c.maxShock || 0, mH = c.maxHeat || 0, mE = c.maxElec || 0;
    let mMp = c.maxMp || 0, mSt = c.maxSt || 0; 

    let maxSlots = state.maxEquipCount || 1;
    let equipList = Array.isArray(c.equips) ? c.equips.slice(0, maxSlots) : (c.equip ? [c.equip] :[]);

    equipList.forEach(eid => {
        const eq = ITEMS[eid];
        if (eq) {
            t += eq.addTech || 0; e += eq.addExp || 0; d += eq.addDmg || 0; def += eq.addDef || 0;
            aS += eq.atkShock || 0; aH += eq.atkHeat || 0; aE += eq.atkElec || 0;
            mS += eq.addMaxShock || 0; mH += eq.addMaxHeat || 0; mE += eq.addMaxElec || 0;
            mMp += eq.addMaxMp || 0; mSt += eq.addMaxSt || 0; 
        }
    });

    // 🌟 特性無効化（かたやぶり等）の判定
    let myTrait = c.trait || "none";
    if (opponentTrait === "mold_breaker") {
        const ignoreTraits = ["metal_body", "sturdy", "levitate", "magic_bounce", "ultra_body", "wonder_guard", "hard_body", "evasion_step", "gamble_body", "iron_wall", "pressure", "triple_mirror", "status_mirror", "break_mirror", "gourmet_body", "energy_convert", "overflow", "reverse_affinity"];
        if (ignoreTraits.includes(myTrait)) myTrait = "none";
    }

    if (includeTempBuff && opponentTrait !== "unaware") {
        let sb = c.statBuff || 0;
        t += sb; e += sb;
        d += sb; def += sb;
    }

    // 🌟 底力（HP残量によるリアルタイム変動）
    if (myTrait === "potential") {
        let hpPer = c.hp / c.maxHp;
        if (hpPer <= 0.25) { t = Math.floor(t * 1.50); e = Math.floor(e * 1.50); }
        else if (hpPer <= 0.5) { t = Math.floor(t * 1.25); e = Math.floor(e * 1.25); }
    }

    // 🌟 軍師（タクティカル盤面も含めて正しく判定）
    let hasStrategist = false;
    let myTeam = isPlayer ? state.player.slice(0, state.battleMemberCount || 3) : state.enemy;
    hasStrategist = myTeam.some(u => u && u.hp > 0 && u.trait === "strategist");
    
    if (hasStrategist && myTrait !== "strategist") {
        t = Math.floor(t * 1.10); // 10%アップ
    }

    if (state.shingariActive && isPlayer) {
        d = Math.floor(d * 1.2); def = Math.floor(def * 1.2);
    }

    let finalMaxHp = c.maxHp || 1;
    if (c.status === "hp_curse") finalMaxHp = Math.max(1, Math.floor(finalMaxHp / 2));
    if (c.status === "res_curse") {
        mS = Math.max(1, Math.floor(mS / 2)); mH = Math.max(1, Math.floor(mH / 2)); mE = Math.max(1, Math.floor(mE / 2));
    }

    return {
        tech: Math.max(0, t), exp: Math.max(0, e), dmg: Math.max(0, d), def: Math.max(0, def),
        maxDice: Math.max(1, t + e),
        atkShock: Math.max(0, aS), atkHeat: Math.max(0, aH), atkElec: Math.max(0, aE),
        maxShock: mS, maxHeat: mH, maxElec: mE, maxMp: mMp, maxSt: mSt, actualMaxHp: finalMaxHp
    };
}
window.calculateDamage = function (attacker, defender, skill, isCrit) {
    const atkTrait = attacker.trait || "none";
    const defTrait = defender.trait || "none";

    const atkStats = getStats(attacker, state.player.includes(attacker), defTrait);
    const defStats = getStats(defender, state.player.includes(defender), atkTrait);

    let defVal = defStats.def + Math.floor(defStats.exp / 10);

    // 防御側の補正
    if (defTrait === "def_gamble") {
        defVal = Math.random() < 0.5 ? defVal * 2 : Math.floor(defVal * 0.5);
    }
    if (state.enableResistance && defender.breakHeat > 0) defVal = 0; // 熱量ブレイクで防御0
    if (defender.status === "frostbite") defVal = Math.floor(defVal / 2); // 凍傷で防御半減
    if (defender.status === "harden") defVal *= 2; // 硬化で防御2倍

    let atkVal = atkStats.dmg + Math.floor(atkStats.tech / 10);

    // 攻撃側の補正
    if (atkTrait === "atk_gamble") {
        atkVal = Math.random() < 0.5 ? atkVal * 2 : Math.floor(atkVal * 0.5);
    }

    let dmgMod = (skill && skill.dmg_mod) ? skill.dmg_mod : 1.0;
    if (atkTrait === "guts" && attacker.status !== "none") dmgMod *= 1.5;
    if (attacker.status === "aggressive") dmgMod *= 2;
    if (atkTrait === "surprise" && attacker.isFirstTurn) dmgMod *= 2;
    if (attacker.status === "rage") dmgMod *= 3; // 憤怒（与ダメ3倍）

    if (atkTrait === "adversity") {
        let hpPer = attacker.hp / attacker.maxHp;
        if (hpPer <= 0.25) dmgMod *= 1.75;
        else if (hpPer <= 0.50) dmgMod *= 1.5;
    }

    // 🌟 基本ダメージ算出
    let dmg = (atkVal * dmgMod) - defVal;
    dmg = Math.max(1, Math.floor(dmg));

    // 🌟 テンションによる最終ダメージ補正
    if (state.enableTension) {
        // 🌟 修正：多段ヒット中は、攻撃開始時に記録されたテンション値（tempTensionForCalc）を使用する！
        let aTen = attacker.tempTensionForCalc !== undefined ? attacker.tempTensionForCalc : (attacker.tension || 0);
        let dTen = defender.tension || 0;

        // 🌟 特性：しゅせい（守勢 - 攻防の倍率を入れ替える）
        let aIsDefense = (attacker.trait === "defensive");
        let dIsDefense = (defender.trait === "defensive");

        // 🌟 特性：ぜんしんぜんれい（全身全霊 - テンション効果2倍）
        let aIsFullForce = (attacker.trait === "full_force");
        let dIsFullForce = (defender.trait === "full_force");

        // 倍率テーブル取得関数（引数1: テンション値, 引数2: しゅせいフラグ, 引数3: ぜんしんぜんれいフラグ）
        const getTensionMult = (ten, isDef, isFF) => {
            let atkM = 1.0, defM = 1.0;

            if (ten === 100) { atkM = 10.0; defM = 0.05; }
            else if (ten === 50) { atkM = 5.0; defM = 0.25; }
            else if (ten === 25) { atkM = 2.5; defM = 0.50; }
            else if (ten === 5) { atkM = 1.5; defM = 0.75; }
            else if (ten === -5) { atkM = 0.75; defM = 1.25; }
            else if (ten === -25) { atkM = 0.50; defM = 1.50; }
            else if (ten === -50) { atkM = 0.25; defM = 2.50; }
            else if (ten === -100) { atkM = 0.01; defM = 5.00; }

            // しゅせい：与ダメと被ダメの倍率を逆転させる
            if (isDef) { let temp = atkM; atkM = 1 / defM; defM = 1 / temp; }

            // ぜんしんぜんれい：倍率の影響力を2倍（二乗）にする
            if (isFF) { atkM = atkM * atkM; defM = defM * defM; }

            return { atk: atkM, def: defM };
        };

        let aMult = getTensionMult(aTen, aIsDefense, aIsFullForce).atk;
        let dMult = getTensionMult(dTen, dIsDefense, dIsFullForce).def;

        dmg = Math.floor(dmg * aMult * dMult);
    }

    // 🌟 最終補正 (isCrit など)
    if (defender.status === "rage") dmg *= 2;
    if (isCrit) dmg *= (atkTrait === "sniper" ? 3 : 2); // スナイパーなら3倍
    if (state.enableResistance && defender.breakElec > 0) dmg *= 2; // 電磁ブレイクで被ダメ2倍
    if (defender.status === "bleed") dmg *= 2; // 出血で被ダメ2倍

    // 会心完全ガード
    if (defTrait === "perfect_guard" && isCrit) {
        dmg = 0;
    }

    return dmg;
};
window.getFinalAffinity = function(defender, element, attackerTrait = "none") {
    if (element === "none") return "nm";

    let affinity = defender["aff_" + element] || "nm";
    const AFF_ORDER = ["wk", "nm", "hl", "rs", "nu", "rp", "ab"];

    // 1. 装備品による相性の上書き（より強い耐性を優先）
    let eqList = Array.isArray(defender.equips) ? defender.equips : (defender.equip ? [defender.equip] : []);
    eqList.forEach(eid => {
        if (eid && ITEMS[eid] && ITEMS[eid]["aff_" + element] && ITEMS[eid]["aff_" + element] !== "nm") {
            let eqAff = ITEMS[eid]["aff_" + element];
            if (AFF_ORDER.indexOf(eqAff) > AFF_ORDER.indexOf(affinity)) affinity = eqAff;
        }
    });

    let defTrait = defender.trait || "none";
    
    // 2. 特性「かたやぶり」による防御特性の無効化
    if (attackerTrait === "mold_breaker") {
        const ignoreTraits = ["metal_body", "sturdy", "levitate", "magic_bounce", "ultra_body", "wonder_guard", "hard_body", "evasion_step", "gamble_body", "iron_wall", "pressure", "triple_mirror", "status_mirror", "break_mirror", "gourmet_body", "energy_convert", "overflow", "reverse_affinity"];
        if (ignoreTraits.includes(defTrait)) defTrait = "none";
    }

    // 3. 特殊な状態異常による強制上書き（最優先）
    if (defender.status === "fragile") affinity = "wk"; // 脆弱：すべて弱点
    else if (defender.status === "fortress") affinity = "nu"; // 堅牢：すべて無効
    else if (defender.status === "flat") affinity = "hl"; // 均一：すべて半減
    
    // 4. 特性による完全無効化
    if (defTrait === "levitate" && element === "earth") affinity = "nu"; // ふゆう：大地無効

    // 5. 耐性ダウン（ブレイク効果など）の計算
    let downSteps = 0;
    if (defTrait !== "ultra_body") { // ウルトラボディは耐性ダウンを無効化
        if (defender.status === "rot") downSteps++; // 腐敗：1段階ダウン
        if (attackerTrait === "guard_break") downSteps++;
        if (attackerTrait === element + "_break") downSteps += 2;
    }

    if (downSteps > 0) {
        let idx = AFF_ORDER.indexOf(affinity);
        if (idx !== -1) {
            // 弱点(wk)より下には下がらないように計算
            idx = Math.max(0, idx - downSteps); 
            affinity = AFF_ORDER[idx];
        }
    }

    // 6. 最終処理：特性「あべこべ（逆転）」
    if (defTrait === "reverse_affinity") {
        const reverseMap = { "wk": "ab", "nm": "rp", "hl": "nu", "rs": "rs", "nu": "hl", "rp": "nm", "ab": "wk" };
        if (reverseMap[affinity]) affinity = reverseMap[affinity];
    }

    return affinity;
};

function processResTurnEnd(char, isPlayer = false) {
    if (!state.enableResistance) return;
    const stats = getStats(char, isPlayer);
    const recMult = (char.status === "aging") ? 0.5 : 1;
    if (char.breakShock > 0) { 
        if (char.breakShockTurn !== state.turnCount) { // 🌟 
            char.breakShock--; 
            if (char.breakShock <= 0) { char.curShock = stats.maxShock; sysLog(`[復旧] ${char.name}の衝撃`); } 
        }
    } else { 
        char.curShock = Math.min(stats.maxShock, char.curShock + Math.floor((char.recShock || 0) * recMult)); 
    }

    if (char.breakHeat > 0) { 
        if (char.breakHeatTurn !== state.turnCount) { // 🌟 
            char.breakHeat--; 
            if (char.breakHeat <= 0) { char.curHeat = stats.maxHeat; sysLog(`[復旧] ${char.name}の熱量`); } 
        }
    } else { 
        char.curHeat = Math.min(stats.maxHeat, char.curHeat + Math.floor((char.recHeat || 0) * recMult)); 
    }

    if (char.breakElec > 0) { 
        if (char.breakElecTurn !== state.turnCount) { // 🌟 
            char.breakElec--; 
            if (char.breakElec <= 0) { char.curElec = stats.maxElec; sysLog(`[復旧] ${char.name}の電磁`); } 
        }
    } else { 
        char.curElec = Math.min(stats.maxElec, char.curElec + Math.floor((char.recElec || 0) * recMult)); 
    }
}
window.processAllStatusTurnEnd = async function () {
    let activePlayers = state.player.slice(0, state.battleMemberCount || 3);
    let activeEnemies = state.enemy;

    // 「わざわい」の処理（場に出た時やターン毎の耐性半減）
    await triggerOmenTrait();

    // 🌟 修正1：盤面にいる全生存者をまとめ、「熟練度（tech + exp）」の高い順にソートする
    let allActiveChars = [...activePlayers, ...activeEnemies].filter(c => c && c.hp > 0);

    allActiveChars.sort((a, b) => {
        // それぞれの現在のステータス（バフ込み）を取得
        let aStats = getStats(a, state.player.includes(a));
        let bStats = getStats(b, state.player.includes(b));

        let aScore = aStats.tech + aStats.exp;
        let bScore = bStats.tech + bStats.exp;

        if (aScore !== bScore) {
            return bScore - aScore; // 高い順（降順）
        } else {
            // 同値の場合は、同期された乱数を使って公平に決める
            return Math.random() < 0.5 ? -1 : 1;
        }
    });

    // テンションシステムの処理
    if (state.enableTension) {

        // 🌟 修正2：「たいこう」判定用の気迫ポイント変換関数
        const getTensionPoint = (ten) => {
            if (ten >= 100) return 100;
            if (ten >= 50) return 75;
            if (ten >= 25) return 50;
            if (ten >= 5) return 25;
            return 0; // マイナスや0は気迫なし
        };

        // 順番に特性を処理していく
        for (let c of allActiveChars) {
            if (c.hp <= 0) continue; // 処理の途中で死んだ場合はスキップ

            let trait = c.trait || "none";
            let isP = state.player.includes(c);

            // 自分から見た「敵チーム」の現在の気迫ポイント合計をリアルタイムに計算
            let targetEnemies = isP ? activeEnemies : activePlayers;
            let enemyTensionSum = 0;
            targetEnemies.forEach(e => {
                if (e && e.hp > 0) {
                    enemyTensionSum += getTensionPoint(e.tension || 0);
                }
            });

            // ① 暴走機関：HP20%ダメージ ＆ テンション+5
            if (trait === "runaway_engine") {
                let recoil = Math.max(1, Math.floor(c.maxHp * 0.2));
                c.hp = Math.max(1, c.hp - recoil);
                await changeTension(c, 5, `【暴走機関】 命を削り、`);
            }
            // ② 一発逆転：残りHP5%以下で テンション+25
            else if (trait === "turnabout" && (c.hp / c.maxHp) <= 0.05) {
                await changeTension(c, 25, `【一発逆転】 死の淵で、`);
            }
            // ③ たいこう：敵陣の気迫ポイント合計が「100以上」なら、自分も100になる
            else if (trait === "rivalry" && enemyTensionSum >= 100 && (c.tension || 0) < 100) {
                await changeTension(c, 100, `【たいこう】 敵軍の凄まじい気迫にあてられ、`);
            }
            // ④ わるぐち：敵全員のテンションをランダムで±5する
            else if (trait === "badmouth") {
                await showMsg(`【わるぐち】 ${c.name} の罵倒が 響き渡る……！`);
                await wait(800);
                for (let e of targetEnemies) {
                    if (e && e.hp > 0) {
                        let amt = Math.random() < 0.5 ? 5 : -5;
                        await changeTension(e, amt, "");
                    }
                }
            }
        }
    }

    // 全員のターン終了処理（毒ダメージや自動回復など）を、同じく「熟練度順」で実行
    const isTacticalDuel = state.tacData && document.getElementById("view-tactical");

    for (let c of allActiveChars) {
        if (!isTacticalDuel) {
            await processSingleCharTurnEnd(c, state.player.includes(c));
        } else {
            // タクティカル決闘中は、初回ターンのフラグや再装填(recharge)だけを消費させる
            c.isFirstTurn = false;
            if (c.rechargeTurn > 0) c.rechargeTurn--;
        }
    }
};
async function checkLevelUp(p) {
    let leveledUp = false;
    let nextExp = p.level * 50;
    let gainedSp = 0;
    if (!p.level || p.level < 1) p.level = 1;

    let learnedNewSkills = [];
    let levelSkillMap = {};
    if (p.level_skills) {
        p.level_skills.split(',').forEach(pair => {
            let [lv, sid] = pair.split(':');
            if (lv && sid) levelSkillMap[parseInt(lv.trim())] = sid.trim();
        });
    }

    while (p.levelExp >= nextExp) {
        if (state.maxLevel > 0 && p.level >= state.maxLevel) {
            p.levelExp = nextExp - 1;
            break;
        }
        p.levelExp -= nextExp;
        p.level++;
        leveledUp = true;
        gainedSp += 5;

        if (levelSkillMap[p.level]) {
            let newSkillId = levelSkillMap[p.level];
            if (SKILLS[newSkillId] && (!p.skills || !p.skills.includes(newSkillId))) {
                if (!p.skills) p.skills = [];
                p.skills.push(newSkillId);
                learnedNewSkills.push(SKILLS[newSkillId].name);
            }
        }

        nextExp = p.level * 50;
    }

    if (leveledUp) {
        p.sp = (p.sp || 0) + gainedSp;
        p.hp = p.maxHp;
        if (typeof initResistance === 'function') initResistance(p, true);

        let skillMsg = learnedNewSkills.length > 0 ? `\n✨ 新しい技【${learnedNewSkills.join("・")}】をひらめいた！` : "";
        await showMsg(`${p.name} は レベルアップした！\nスキルポイントを ${gainedSp} 獲得！${skillMsg}`);

        // 🌟 修正：要素が存在するかチェックしてフリーズを防止
        let pAaEl = document.getElementById("p-aa");
        if (pAaEl) {
            pAaEl.classList.add("level-up-anim");
            setTimeout(() => { if (pAaEl) pAaEl.classList.remove("level-up-anim"); }, 1000);
        } else {
            // パーティバトルの場合はカード全体を光らせる
            let cardEl = document.getElementById(`card-${p.id}`);
            if (cardEl) {
                cardEl.classList.add("level-up-anim");
                setTimeout(() => { if (cardEl) cardEl.classList.remove("level-up-anim"); }, 1000);
            }
        }
        await updateUI();
        await wait(2500);
    }
}
function getStatusIcon(char) {
    if (!char.status || char.status === "none" || char.hp <= 0) return "";
    
    const sName = STATUS_NAMES[char.status];
    // 状態異常の簡単な説明文を定義
    const statusDesc = {
        poison: "毎ターン最大HPの10%ダメージ", deadly_poison: "毎ターン全耐性にダメージ", rot: "受ける全属性の相性が1段階悪化",
        freeze: "回避時、相手の命中に+3の補正", frostbite: "防御力が半減する", paralysis: "攻撃時、自身の命中に-3の補正",
        burn: "毎ターンHPに20の固定ダメージ", blaze: "毎ターン全耐性に固定ダメージ", sleep: "戦闘ダイスが半減。回避不可",
        confusion: "戦闘ダイス勝利時、50%で自傷", bleed: "受けるダメージが2倍になる", harden: "防御力が2倍になる",
        drown: "技の反動ダメージが2倍になる", charm: "クリティカル(10)以外外れる", seal: "アイテム使用不可",
        slow: "パーティバトルの行動順が最後尾", fast: "パーティバトルの行動順が最速", focus: "命中ダイスに+1の補正",
        reverse: "戦闘ダイスの勝敗と行動順が逆転", stone: "行動・回避不可", provoke: "通常攻撃しか出せない",
        aging: "耐性の自動回復(REC)が半減", protect: "耐性へのダメージを無効化", invincible: "HPへのダメージを無効化",
        stagnate: "ブレイクからの復旧ターンが2倍", aggressive: "与えるダメージが2倍", exception: "直前の技が使用不可",
        repetition: "直前の技しか使用不可", doom: "3ターン後に確実な死が訪れる", surehit: "お互いの攻撃が必中になる",
        fragile: "受ける全属性が『弱点』になる", fortress: "受ける全属性が『無効』になる", immovable: "技の反動ダメージが0になる",
        rage: "与ダメ3倍、被ダメ2倍", flat: "受ける全属性が『半減』になる", hp_curse: "最大HPが半分になる",
        res_curse: "全耐性の最大値が半分になる", dodge: "相手の命中率を半分にする"
    };

    const desc = statusDesc[char.status] || "状態異常";

    return `
    <div class="tooltip-container" style="text-align:center; margin-bottom:2px; display:inline-block;">
        <span style="background:#e53e3e; color:#fff; font-size:9px; padding:1px 4px; border-radius:3px; font-weight:bold;">${sName} ${char.statusTurn}T</span>
        <div class="tooltip-text">${desc}</div>
    </div>`;
}

// ミニ耐性ゲージを生成する関数
function getMiniResBars(char, isPlayer) {
    if (!state.enableResistance || char.hp <= 0) return "";
    const stats = getStats(char, isPlayer);

    const sMax = stats.maxShock || 100; const hMax = stats.maxHeat || 100; const eMax = stats.maxElec || 100;
    const sPer = char.breakShock > 0 ? 0 : (char.curShock / sMax * 100);
    const hPer = char.breakHeat > 0 ? 0 : (char.curHeat / hMax * 100);
    const ePer = char.breakElec > 0 ? 0 : (char.curElec / eMax * 100);

    const sText = char.breakShock > 0 ? `<span style="color:#e53e3e;">BRK${char.breakShock}</span>` : "";
    const hText = char.breakHeat > 0 ? `<span style="color:#e53e3e;">BRK${char.breakHeat}</span>` : "";
    const eText = char.breakElec > 0 ? `<span style="color:#e53e3e;">BRK${char.breakElec}</span>` : "";

    return `
    <div style="display:flex; flex-direction:column; gap:2px; margin-top:4px; padding-top:4px; border-top:1px dashed #cbd5e0;">
        <div style="display:flex; align-items:center; height:6px;">
            <span style="font-size:8px; width:12px; color:var(--c-shock); font-weight:bold;">衝</span>
            <div class="p-bar-wrap" style="margin:0; height:4px; flex:1;"><div class="p-bar-fill js-shk-bar" style="background:var(--c-shock); width:${sPer}%;"></div></div>
            <span style="width:22px; text-align:right; font-size:8px; font-weight:bold;">${sText}</span>
        </div>
        <div style="display:flex; align-items:center; height:6px;">
            <span style="font-size:8px; width:12px; color:var(--c-heat); font-weight:bold;">熱</span>
            <div class="p-bar-wrap" style="margin:0; height:4px; flex:1;"><div class="p-bar-fill js-het-bar" style="background:var(--c-heat); width:${hPer}%;"></div></div>
            <span style="width:22px; text-align:right; font-size:8px; font-weight:bold;">${hText}</span>
        </div>
        <div style="display:flex; align-items:center; height:6px;">
            <span style="font-size:8px; width:12px; color:var(--c-elec); font-weight:bold;">電</span>
            <div class="p-bar-wrap" style="margin:0; height:4px; flex:1;"><div class="p-bar-fill js-elc-bar" style="background:var(--c-elec); width:${ePer}%;"></div></div>
            <span style="width:22px; text-align:right; font-size:8px; font-weight:bold;">${eText}</span>
        </div>
    </div>`;
}
window.updateUI = async function () {
    // 🌟 1. 呪詛・呪縛による上限クリップ処理（全キャラ共通）
    let allActiveChars = [...state.player, ...state.enemy];
    allActiveChars.forEach(c => {
        if (c && c.hp > 0) {
            const stats = getStats(c, state.player.includes(c));
            if (c.hp > stats.actualMaxHp) c.hp = stats.actualMaxHp;
            if (state.enableResistance) {
                if (c.curShock > stats.maxShock) c.curShock = stats.maxShock;
                if (c.curHeat > stats.maxHeat) c.curHeat = stats.maxHeat;
                if (c.curElec > stats.maxElec) c.curElec = stats.maxElec;
            }
        }
    });

    // 🌟 2. 描画エリアの準備（1vs1用 と パーティ用 の両方を用意する）
    let pf = document.getElementById("party-field");
    const bf = document.querySelector(".battle-field"); // 1vs1用のコンテナ
    
    // パーティ用のコンテナが無ければ作る
    // パーティ用のコンテナが無ければ作る
    if (!pf) {
        pf = document.createElement("div"); 
        pf.id = "party-field"; 
        pf.className = "party-field scroll-area";
        pf.innerHTML = `<div class="party-row" id="pf-enemy"></div><div class="party-row" id="pf-player"></div>`;
        
        // 🌟 修正：bfが存在する場合のみ直前に挿入。なければ親(battle-view等)に追加する。
        const container = document.getElementById("view-battle");
        if (bf && bf.parentNode) {
            bf.parentNode.insertBefore(pf, bf);
        } else if (container) {
            container.appendChild(pf);
        }
    }

    // ==========================================
    // 🌟 3. 【パーティーバトル】の描画ロジック
    // ==========================================
    if (state.enablePartyBattle) {
        // 🔴 超重要：1vs1用のバーを「確実に」消す！
        if (bf) bf.style.setProperty("display", "none", "important");
        // パーティ用のカード枠を表示する
        pf.style.setProperty("display", "flex", "important");

        const maxMembers = state.battleMemberCount || 3;

        let ePromises = state.enemy.slice(0, maxMembers).map((e, i) => {
            let actOrder = -1; let turnDice = null;
            if (state.partyBattle && state.partyBattle.phase === 'execute' && state.partyBattle.actions) {
                let act = state.partyBattle.actions.find(a => a.isPlayer === false && a.actorIdx === i);
                if (act) { actOrder = state.partyBattle.actions.indexOf(act) + 1; turnDice = act.initDice; }
            }
            return generateCharCardHTML(e, "party", { idx: i, actOrder, turnDice });
        });

        let pPromises = state.player.slice(0, maxMembers).map((p, i) => {
            let isActive = (state.partyBattle && state.partyBattle.phase === 'command' && state.partyBattle.currentActorIdx === i);
            let isReady = (state.partyBattle && state.partyBattle.phase === 'command' && state.partyBattle.actions && state.partyBattle.actions[i] !== null);
            let actOrder = -1; let turnDice = null;
            if (state.partyBattle && state.partyBattle.phase === 'execute' && state.partyBattle.actions) {
                let act = state.partyBattle.actions.find(a => a.isPlayer === true && a.actorIdx === i);
                if (act) { actOrder = state.partyBattle.actions.indexOf(act) + 1; turnDice = act.initDice; }
            }
            return generateCharCardHTML(p, "party", { isActive, isReady, idx: i, actOrder, turnDice });
        });
        const eHtmls = await Promise.all(ePromises);
        const pHtmls = await Promise.all(pPromises);

        document.getElementById("pf-enemy").innerHTML = eHtmls.join("");
        document.getElementById("pf-player").innerHTML = pHtmls.join("");
        
        updateBattleButtons();
        resizeAllAAs(); 
        return; // 🌟 ここで終了！下の1vs1処理には絶対に行かせない。
    }

    // ==========================================
    // 🌟 4. 【非パーティーバトル（1vs1）】の描画ロジック
    // ==========================================
    const p = state.player[state.activeP], e = state.enemy[state.activeE]; 
    if (!p || !e) return; 

    // 🔴 超重要：パーティ用のカード枠を「確実に」消す！
    pf.style.setProperty("display", "none", "important");
    // 1vs1用のバーを表示する
    if (bf) bf.style.setProperty("display", "flex", "important");
    
    // (以降、pS = getStats... などの既存の1vs1処理が続く)
    const pS = getStats(p, true, e.trait || "none"), eS = getStats(e, false, p.trait || "none");
    const pLvEl = document.getElementById("p-lv");
    if (pLvEl) { 
        if (state.enableLevelUp) { pLvEl.innerText = `Lv.${p.level}`; pLvEl.style.display = "inline-block"; } 
        else { pLvEl.style.display = "none"; } 
    }
    
    document.getElementById("p-name").innerText = p.name;
    const pAAEl = document.getElementById("p-aa"); // 🌟
    pAAEl.innerText = await getFace(p);
    fitAAToContainer(pAAEl.querySelector('pre') || pAAEl, pAAEl); // 🌟通信を待つ前に即リサイズ！
    document.getElementById("p-hp-bar").style.width = (p.hp / p.maxHp * 100) + "%";
    document.getElementById("p-hp-text").innerText = `${p.hp} / ${p.maxHp}`;
    
    let pEqList = Array.isArray(p.equips) ? p.equips : (p.equip ? [p.equip] :[]);
    let eqNames = pEqList.map(eid => (eid && ITEMS[eid]) ? ITEMS[eid].name : "").filter(n => n).join("/");
    if (!eqNames) eqNames = "なし";

    const buildResourceRow = (char) => {
        // 🌟 追加：システムがOFFなら空っぽの空間を返して非表示にする
        if (!state.enableMpSt) return "";

        let mpPer = char.maxMp > 0 ? (char.mp / char.maxMp * 100) : 0;
        let stPer = char.maxSt > 0 ? (char.st / char.maxSt * 100) : 0;
        const valStyle = `position:absolute; width:100%; text-align:center; font-size:8px; font-weight:bold; color:#fff; text-shadow:1px 1px 1px #000; line-height:8px; top:0; left:0; pointer-events:none;`;
        
        return `
            <div style="display:flex; gap:6px; height:12px; align-items:center; margin-bottom:1px;">
                <div style="flex:1; display:flex; align-items:center; gap:2px;">
                    <span style="font-size:8px; color:#9f7aea; font-weight:bold;">M</span>
                    <div class="p-bar-wrap" style="height:8px; flex:1; margin:0; position:relative; background:#1a202c; border-radius:3px; overflow:hidden; border:1px solid #000;">
                        <div class="p-bar-fill" style="background:#9f7aea; width:${mpPer}%; height:100%;"></div>
                        <span style="${valStyle}">${Math.floor(char.mp)}</span>
                    </div>
                </div>
                <div style="flex:1; display:flex; align-items:center; gap:2px;">
                    <span style="font-size:8px; color:#ed8936; font-weight:bold;">S</span>
                    <div class="p-bar-wrap" style="height:8px; flex:1; margin:0; position:relative; background:#1a202c; border-radius:3px; overflow:hidden; border:1px solid #000;">
                        <div class="p-bar-fill" style="background:#ed8936; width:${stPer}%; height:100%;"></div>
                        <span style="${valStyle}">${Math.floor(char.st)}</span>
                    </div>
                </div>
            </div>`;
    };

    // 🌟 修正：各行の margin-bottom を 2px → 1px に詰め、高さを微調整
    const pStatusStr = getStatusIcon(p); // 👈 以前の長い<span>をやめて、ツールチップ付きの関数を呼ぶ
    
    // 🌟 漏れていた定義：特性のラベルを作成
    const pTraitName = TRAITS[p.trait]?.name || "なし";
    const pTraitDesc = TRAITS[p.trait]?.desc || "特に効果はない。";
    const pTraitLabelHtml = `
    <div class="tooltip-container" style="display:inline-block;">
        <span style="background:#edf2f7; color:#553c9a; padding:1px 6px; border-radius:4px; font-size:9px; font-weight:bold; border:1px solid #d6bcfa;">
            特: ${pTraitName}
        </span>
        <div class="tooltip-text" style="font-weight:normal; color:#e2e8f0;">${pTraitDesc}</div>
    </div>`;

    document.getElementById("p-stats").innerHTML = `
        ${pTenHtml}
        <div style="height:14px; line-height:14px; margin-bottom:1px; font-size:12px;">
            <span style="color:#2b6cb0">技:${pS.tech}</span> <span style="color:#38a169">経:${pS.exp}</span> / 攻:${pS.dmg + Math.floor(pS.tech / 10)} 防:${pS.def + Math.floor(pS.exp / 10)} 
        </div>
        ${buildResourceRow(p)}
        <div style="min-height:14px; margin-bottom:1px; display:flex; align-items:center; font-size:12px; gap:5px;">
            ${pTraitLabelHtml} ${pStatusStr}
        </div>
        <div style="font-size:10px; height:12px; line-height:12px;">装備:${eqNames}</div>
        ${getAffinityIcons(p)}
    `;
    
    // --- 敵側も同様に修正 ---
    document.getElementById("e-name").innerText = e.name;
    document.getElementById("e-aa").innerText = await getFace(e);
    document.getElementById("e-hp-bar").style.width = (e.hp / e.maxHp * 100) + "%";
    document.getElementById("e-hp-text").innerText = `${e.hp} / ${e.maxHp}`;
    
    let eEqList = Array.isArray(e.equips) ? e.equips : (e.equip ? [e.equip] :[]);
    let eEqNames = eEqList.map(eid => (eid && ITEMS[eid]) ? ITEMS[eid].name : "").filter(n => n).join("/");
    if (!eEqNames) eEqNames = "なし";

    // 🌟 ここを修正：味方と同じく getStatusIcon 関数を使うようにします
    const eStatusStr = getStatusIcon(e); 
    
    let eTenHtml = state.enableTension && e.tension !== 0 ? `<div style="color:#dd6b20; font-weight:bold; height:12px; line-height:12px; font-size:11px; margin-bottom:1px;">🔥${e.tension}</div>` : `<div style="height:1px;"></div>`;
    const eTraitName = TRAITS[e.trait]?.name || "なし";
    const eTraitDesc = TRAITS[e.trait]?.desc || "特に効果はない。";
    const eTraitLabelHtml = `
    <div class="tooltip-container" style="display:inline-block;">
        <span style="background:#edf2f7; color:#553c9a; padding:1px 6px; border-radius:4px; font-size:9px; font-weight:bold; border:1px solid #d6bcfa;">
            特: ${eTraitName}
        </span>
        <div class="tooltip-text" style="font-weight:normal; color:#e2e8f0;">${eTraitDesc}</div>
    </div>`;

    document.getElementById("e-stats").innerHTML = `
        ${eTenHtml}
        <div style="height:14px; line-height:14px; margin-bottom:1px; font-size:12px;">
            <span style="color:#2b6cb0">技:${eS.tech}</span> <span style="color:#38a169">経:${eS.exp}</span> / 攻:${eS.dmg + Math.floor(eS.tech / 10)} 防:${eS.def + Math.floor(eS.exp / 10)} 
        </div>
        ${buildResourceRow(e)}
        <div style="min-height:14px; margin-bottom:1px; display:flex; align-items:center; font-size:12px; gap:5px;">
            ${eTraitLabelHtml} ${eStatusStr}
        </div>
        <div style="font-size:10px; height:12px; line-height:12px;">装備:${eEqNames}</div>
        ${getAffinityIcons(e)}
    `;
    ["p", "e"].forEach(t => {
        const c = t === "p" ? p : e; 
        const stats = t === "p" ? pS : eS;
        
        const container = document.getElementById(`${t}-res-container`);
        if (container) container.style.display = state.enableResistance ? "flex" : "none";

        if (state.enableResistance) {
            ["Shock", "Heat", "Elec"].forEach(res => {
                const s = res === "Shock" ? "shk" : res === "Heat" ? "het" : "elc";
                const bar = document.getElementById(`${t}-${s}-bar`); 
                const txt = document.getElementById(`${t}-${s}-txt`);
                const sMax = res === "Shock" ? stats.maxShock : res === "Heat" ? stats.maxHeat : stats.maxElec;
                
                if (c["break" + res] > 0) { 
                    // ブレイク中
                    if (bar) bar.style.width = "0%"; 
                    if (txt) txt.innerHTML = `<span>BRK ${c["break" + res]}</span>`; 
                }
                else { 
                    // 通常時
                    if (bar) bar.style.width = (c["cur" + res] / sMax * 100) + "%"; 
                    if (txt) txt.innerText = `${c["cur" + res]} / ${sMax}`; 
                }
            });
        }
    });
    updateBattleButtons();
    
    // 🌟 修正：画面の要素がDOMに完全に配置された直後にリサイズをかける
    // （ピンチ・回復などのHP変動による顔変化を確実にキャッチする）
    requestAnimationFrame(() => {
        resizeAllAAs(); 
    });

    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        if (state.isAnimating) {
            appContainer.classList.add('is-processing');
        } else {
            appContainer.classList.remove('is-processing');
        }
    }
};

// 🌟 追加：ボタンの表示/非表示をコントロールする内部関数
function updateBattleButtons() {
    const btnEscape = document.getElementById("btn-escape");
    const btnScout = document.getElementById("btn-scout");

    let canEscape = (state.enableEscape !== "false" && state.enableEscape !== false);
    if (state.tacData && state.tacData.hasEscapedThisRound) {
        canEscape = false; // 背水の陣
    }

    if (btnEscape) btnEscape.style.display = canEscape ? "block" : "none";
    if (btnScout) btnScout.style.display = (state.enableScout === "false" || state.enableScout === false) ? "none" : "block";
}
// --- バトルシステム刷新 ---

window.openSub = async function (type, param) {
    if (state.isAnimating) return;

    // 🌟 最重要：パーティバトル中なら、現在選択中のキャラ(currentActorIdx)を activeP に強制同期する
    if (state.enablePartyBattle && state.partyBattle) {
        if (state.partyBattle.currentActorIdx !== -1) {
            state.activeP = state.partyBattle.currentActorIdx;
        }
    }

    // 🌟 同期された activeP を使って操作対象のキャラを取得
    const p = state.player[state.activeP];
    if (!p) return; // キャラが見つからなければ中断

    // --- システム制限チェック ---
    if (type === "item" && (state.enableItemUse === "false" || state.enableItemUse === false)) {
        await showMsg("このバトルでは どうぐ は使用できないお！"); return;
    }
    if (type === "change" && (state.enableSwitch === "false" || state.enableSwitch === false)) {
        await showMsg("このバトルでは 入れ替え はできないお！"); return;
    }
    if (type === "equip" && (state.enableEquipChange === "false" || state.enableEquipChange === false)) {
        await showMsg("このバトルでは 装備変更 はできないお！"); return;
    }

    const list = document.getElementById("sub-list");
    document.getElementById("cmd-main").style.display = "none";
    document.getElementById("cmd-sub").style.display = "flex";

    let htmls = [];

    // ==========================================
    // 1. 道具(item) のリスト生成
    // ==========================================
    if (type === "item") {
        if (p.status === "seal") {
            htmls.push("<div style='color:red; padding:10px;'>封印されていて アイテムが使えない！</div>");
        } else {
            let hasItem = false;
            let reservedItems = {};

            // 🌟 修正：誰かがすでに使う予約をしているアイテムを計算（nullチェック付き）
            if (state.enablePartyBattle && state.partyBattle && state.partyBattle.actions) {
                state.partyBattle.actions.forEach(act => {
                    if (act && act.isPlayer && act.action === "item") {
                        reservedItems[act.param] = (reservedItems[act.param] || 0) + 1;
                    }
                });
            }

            Object.keys(state.inventory).forEach(id => {
                const item = ITEMS[id];
                // 在庫から予約分を引いた数
                let actualStock = state.inventory[id] - (reservedItems[id] || 0);

                if (actualStock > 0 && item && item.type !== "skill_book") {
                    hasItem = true;
                    htmls.push(`<button onclick="executeAction('item', '${id}')">
                        <div class="cmd-title">💊 ${item.name} <span style="font-size:11px; font-weight:normal;">(残${actualStock})</span></div>
                        <div class="cmd-desc">${item.desc}</div>
                    </button>`);
                }
            });
            if (!hasItem) htmls.push("<div style='text-align:center; color:#718096; padding:10px;'>つかえる どうぐ がない！</div>");
        }
    }
    // ==========================================
    // 2. 技(skill) のリスト生成
    // ==========================================
    else if (type === "skill") {
        if (p.status === "provoke") {
            htmls.push("<div style='color:red; padding:10px;'>挑発されていて 技が出せない！</div>");
        } else {
            let displaySkills = [];
            if (state.maxSkills > 0) {
                displaySkills = p.equipSkills ? p.equipSkills.filter(s => s && s !== "none") : p.skills.slice(0, state.maxSkills);
            } else {
                displaySkills = p.skills || [];
            }

            if (state.enableTension) {
                htmls.push(`<button onclick="executeAction('tension_up', 'none')" style="border-color:#e67e22; background:#fffaf0;">
                    <div class="cmd-title" style="color:#dd6b20;">ためる</div>
                    <div class="cmd-desc">テンションを一段階上げる</div>
                </button>`);
            }

           displaySkills.forEach(sid => {
                const skill = SKILLS[sid];
                if (skill) {
                    let isBlocked = (skill.recoil_shock && p.breakShock > 0) || (skill.recoil_heat && p.breakHeat > 0) || (skill.recoil_elec && p.breakElec > 0);
                    
                    // ホバープレビュー
                    let rs = skill.recoil_shock || 0; let rh = skill.recoil_heat || 0; let re = skill.recoil_elec || 0;
                    let rhp = skill.recoil_hp || 0;
                    let hoverEvent = `onmouseenter="previewRecoil(${rs}, ${rh}, ${re}, ${rhp})" onmouseleave="clearRecoilPreview()"`;
                    let touchEvent = `ontouchstart="previewRecoil(${rs}, ${rh}, ${re}, ${rhp})" ontouchend="clearRecoilPreview()"`;

                    let btnAttr = isBlocked ? "disabled style='opacity:0.5; background:#e2e8f0;'" : `onclick="executeAction('attack', '${sid}')" ${hoverEvent} ${touchEvent}`;
                    
                    // 1段目：属性クラス
                    let attrKey = skill.atk_element && skill.atk_element !== "none" ? skill.atk_element : "none";
                    
                    // 2. 状態異常行の作成（🌟 属性クラスを付与して色を連動させる）
                    let statusLabel = "付与: なし";
                    // 異常なしの時はグレー固定、異常ありの時はその属性の「薄い背景色」にする
                    let statusClass = "status-none";
                    if (skill.inflict_status && skill.inflict_status !== "none") {
                        statusLabel = `付与: ${STATUS_NAMES[skill.inflict_status] || skill.inflict_status}`;
                        statusClass = `status-active attr-bg-${attrKey}`; // 🌟 変更
                    }
                    let statusHtml = `<div class="s-status-row ${statusClass}">${statusLabel}</div>`;

                    // 3. 威力と耐性の倍率（🌟 「衝」と「x1.5」が改行されないように nowrap で包む）
                    let dmgMod = skill.dmg_mod !== undefined ? skill.dmg_mod : 1.0;
                    let sMod = skill.mod_shock || 1.0;
                    let hMod = skill.mod_heat || 1.0;
                    let eMod = skill.mod_elec || 1.0;
                    
                    // 🌟 修正：spanの中にさらに span(nowrap) を入れるか、文字全体を nowrap にする
                    let sHtml = `<span class="${sMod !== 1.0 ? 'val-active' : ''}" style="white-space:nowrap;">衝 x${sMod}</span>`;
                    let hHtml = `<span class="${hMod !== 1.0 ? 'val-active' : ''}" style="white-space:nowrap;">熱 x${hMod}</span>`;
                    let eHtml = `<span class="${eMod !== 1.0 ? 'val-active' : ''}" style="white-space:nowrap;">電 x${eMod}</span>`;

                    // 🌟 追加：消費MPとSTのバッジを作成
                    let costHtml = "";
                    if (state.enableMpSt) {
                        let cMp = skill.cost_mp || 0;
                        let cSt = skill.cost_st || 0;
                        let mpColor = p.mp < cMp ? "#e53e3e" : "#9f7aea"; // 足りない時は赤くする
                        let stColor = p.st < cSt ? "#e53e3e" : "#ed8936";
                        costHtml = `
                            <div style="display:flex; gap:5px; font-size:10px; font-weight:bold; background:rgba(255,255,255,0.8); padding:2px 6px; border-radius:10px;">
                                ${cMp > 0 ? `<span style="color:${mpColor};">MP:${cMp}</span>` : ""}
                                ${cSt > 0 ? `<span style="color:${stColor};">ST:${cSt}</span>` : ""}
                            </div>`;
                    }

                    // 🌟 修正：技名の横にコストバッジを並べる
                    htmls.push(`<button ${btnAttr} class="skill-card-v3">
                        <div class="s-name-row attr-${attrKey}" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${skill.name}</span>
                            ${costHtml}
                        </div>
                        <div class="s-status-row ${statusClass}">${statusLabel}</div>
                        <div class="s-spec-row-v3">
                            <div class="spec-phys">物理 x${dmgMod}</div>
                            <div class="spec-res">
                                ${sHtml}${hHtml}${eHtml}
                            </div>
                        </div>
                        <div class="s-desc-row">${skill.desc}${isBlocked ? " <span style='color:red;'>[復旧中不可]</span>" : ""}</div>
                    </button>`);
                }
            });


            if (htmls.length === 0) htmls.push("<div style='text-align:center; color:#718096; padding:10px;'>つかえる 技がない！</div>");
        }
    }
    // ==========================================
    // 3. ターゲット(target) のリスト生成
    // ==========================================
    else if (type === "target") {
        let tType = param || 'enemy_single';
        let canRevive = false;

        // アイテムや特定の技が「蘇生」可能かチェック
        if (state.partyBattle.tempAction === "item" && ITEMS[state.partyBattle.tempParam]?.effect === "heal") canRevive = true;
        if (state.partyBattle.tempAction === "attack" && SKILLS[state.partyBattle.tempParam]?.heal_hp > 0) canRevive = true;

        if (tType === 'ally_single' || tType === 'self') {
            state.player.forEach((pl, i) => {
                if ((pl.hp > 0 || canRevive) && i < 3) {
                    htmls.push(`<button onclick="executePartyCommand(${i})">
                        <div class="cmd-title">💖 ${pl.name}</div>
                        <div class="cmd-desc">HP: ${pl.hp} / ${pl.maxHp}</div>
                    </button>`);
                }
            });
        } else {
            state.enemy.forEach((e, i) => {
                if (e.hp > 0) {
                    htmls.push(`<button onclick="executePartyCommand(${i})">
                        <div class="cmd-title">🎯 ${e.name}</div>
                        <div class="cmd-desc">HP: ${e.hp} / ${e.maxHp}</div>
                    </button>`);
                }
            });
        }
        if (htmls.length === 0) htmls.push("<div style='text-align:center; color:#718096; padding:20px;'>ねらえる 対象がいない！</div>");
    }
    // ==========================================
    // 4. 入れ替え(change) / 装備変更(equip) のリスト生成
    // ==========================================
    else if (type === "change") {
        const memberLimit = state.enablePartyBattle ? (state.battleMemberCount || 3) : 1;
        const travelPartyLimit = 8; // 🌟 旅に連れ歩ける最大人数（1軍＋同行者）

        state.player.forEach((pl, i) => { 
            // パーティなら制限以降、タイマンなら本人以外を控えとする
            const isReserve = state.enablePartyBattle ? (i >= memberLimit) : (i !== state.activeP);
            
            // 🌟 修正：控えであり、かつ同行枠（8人目まで）にいる生存者だけを表示
            if (isReserve && i < travelPartyLimit && pl.hp > 0) {
                htmls.push(`<button onclick="executeAction('change', ${i})">
                    <div class="cmd-title">🔁 ${pl.name}</div>
                    <div class="cmd-desc">HP: ${pl.hp} / ${pl.maxHp}</div>
                </button>`); 
            }
        });
        if (htmls.length === 0) htmls.push("<div style='color:#718096; padding:10px;'>交代できる 同行者がいないお！</div>");
    }

    else if (type === "equip") {
        if (p.status === "seal") {
            htmls.push("<div style='color:red; padding:10px;'>封印されていて 装備変更ができないお！</div>");
        } else {
            // 1. 装備を外す選択肢
            htmls.push(`<button onclick="executeAction('equip', 'none')">
                <div class="cmd-title">❌ 装備を外す</div>
                <div class="cmd-desc">現在装備しているアイテムを外します</div>
            </button>`);

            // 2. 所持している装備品のリストアップ
            let hasEquip = false;
            let equipCounts = {};
            state.ownedEquips.forEach(eid => equipCounts[eid] = (equipCounts[eid] || 0) + 1);

            Object.keys(equipCounts).forEach(eid => {
                const item = ITEMS[eid];
                if (item && item.type === "equip") {
                    // 他のキャラが装備している分を差し引いて計算
                    let equippedByOthers = state.player.filter(other => {
                        let otherEqs = Array.isArray(other.equips) ? other.equips : [other.equip];
                        return otherEqs.includes(eid);
                    }).length;

                    if (equipCounts[eid] > equippedByOthers) {
                        hasEquip = true;
                        let statPlain = getEquipStatText(item).replace(/<[^>]*>?/gm, '');
                        htmls.push(`<button onclick="executeAction('equip', '${eid}')">
                            <div class="cmd-title">🗡️ ${item.name}</div>
                            <div class="cmd-desc">${statPlain} / ${item.desc}</div>
                        </button>`);
                    }
                }
            });
            if (!hasEquip) htmls.push("<div style='text-align:center; color:#718096; padding:10px;'>持ち替えられる 装備がないお！</div>");
        }
    }


    list.innerHTML = htmls.join("");
    // 🌟 アクセシビリティ：最初の有効なボタンにフォーカスを合わせる
    setTimeout(() => {
        const firstBtn = list.querySelector('button:not(:disabled)');
        if (firstBtn) firstBtn.focus();
    }, 10);
};
// ==========================================
// 反動予測（プレビュー）機能
// ==========================================
window.previewRecoil = function (rs, rh, re, rhp) {
    const p = state.player[state.activeP];
    if (!p) return;

    let card = document.getElementById(`card-${p.id}`);
    if (!card) return;

    // 🌟 内部関数：「減る分」の赤いバーを重ねて表示する
    const setPreview = (cls, recoil, current, max) => {
        if (recoil <= 0) return;
        
        let barFill = card.querySelector(cls);
        if (!barFill) return;

        let wrap = barFill.parentElement; // .p-bar-wrap (外枠)
        
        // すでにプレビュー要素があれば消す
        let oldPreview = wrap.querySelector(".recoil-damage-preview");
        if (oldPreview) oldPreview.remove();

        // 減る割合（%）を計算
        let recoilPer = (recoil / max) * 100;
        // 今の残り割合（%）を計算
        let currentPer = (current / max) * 100;
        
        // 減る分が今の残りより多い場合は、今の残りを上限にする
        if (recoilPer > currentPer) recoilPer = currentPer;

        // 🌟 新しい「赤い点滅バー」を作成して右側に被せる
        let previewBar = document.createElement("div");
        previewBar.className = "recoil-damage-preview";
        previewBar.style.width = `${recoilPer}%`;
        previewBar.style.left = `${currentPer - recoilPer}%`; // 今のゲージの右端から減る分だけ左にズラす

        wrap.appendChild(previewBar);
    };

    const stats = getStats(p, true);
    
    // HPのプレビュー
    setPreview(".js-hp-bar", rhp, p.hp, p.maxHp);
    
    // 耐性のプレビュー
    if (state.enableResistance) {
        setPreview(".js-shk-bar", rs, p.curShock, stats.maxShock || 100);
        setPreview(".js-het-bar", rh, p.curHeat, stats.maxHeat || 100);
        setPreview(".js-elc-bar", re, p.curElec, stats.maxElec || 100);
    }
};

window.clearRecoilPreview = function () {
    // 🌟 すべての「減る分プレビューバー」を消去する
    document.querySelectorAll(".recoil-damage-preview").forEach(el => el.remove());
};
window.closeSub = () => {
    // 🌟 修正：余計な「盤面に戻りますか？」という確認処理をすべて削除し、純粋にサブメニューを閉じるだけにする
    document.getElementById("cmd-main").style.display = "";
    document.getElementById("cmd-sub").style.display = "none";
    setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 10);
};

window.executeAction = async function (action, param) {
    if (state.isAnimating) return;
    isSkipping = false;
    stopTurnTimer();
    const p = state.player[state.activeP], e = state.enemy[state.activeE];

    if (action === "attack") {
        let skillId = param === 'normal' ? 'normal' : param;
        let skill = skillId === 'normal' ? null : SKILLS[skillId];
        let skillName = skill ? skill.name : '通常攻撃';
        if (p.status === "exception" && p.lastUsedSkill === skillId) {
            await showMsg(`【例外】状態のため、直前と同じ ${skillName} は使えないお！`);
            return;
        }
        if (p.status === "repetition" && p.lastUsedSkill && p.lastUsedSkill !== skillId) {
            let lastSkillName = p.lastUsedSkill === 'normal' ? '通常攻撃' : (SKILLS[p.lastUsedSkill] ? SKILLS[p.lastUsedSkill].name : '直前の技');
            await showMsg(`【反復】状態のため、${lastSkillName} しか使えないお！`);
            return;
        }
    }

    // 🌟 修正：パーティバトルのコマンド予約処理
    if (state.enablePartyBattle && state.partyBattle && state.partyBattle.phase === 'command') {
        if (action === "scout") {
            state.partyBattle.tempAction = "scout"; state.partyBattle.tempParam = "none";
            openSub('target', 'enemy_single'); return;

        } else if (action === "tension_up") {
            state.partyBattle.tempAction = "tension_up";
            state.partyBattle.tempParam = "none";
            executePartyCommand('self'); return;

        } else if (action === "attack") {
            const skill = param === 'normal' ? null : SKILLS[param];
            let tType = skill ? (skill.target_type || 'enemy_single') : 'enemy_single';
            if (!skill && p.trait === "spread_attack") tType = 'enemy_all';

            state.partyBattle.tempAction = action;
            state.partyBattle.tempParam = param;

            if (['enemy_all', 'ally_all', 'self', 'field_all'].includes(tType)) {
                executePartyCommand(tType); return;
            }
            openSub('target', tType); return;

        } else if (action === "item") {
            const item = ITEMS[param];
            const isSupport = ["heal", "cure_status", "rec_res", "buff", "res_up", "guarantee_hit", "guarantee_dodge", "counter"].includes(item.effect);
            state.partyBattle.tempAction = action;
            state.partyBattle.tempParam = param;

            if (item.effect === "escape") { executePartyCommand('self'); return; }
            openSub('target', isSupport ? 'ally_single' : 'enemy_single'); return;

        } else if (action === "equip" || action === "change") {
            // 🌟 修正：pushではなく、そのキャラの専用スロットに直接保存する
            state.partyBattle.actions[state.partyBattle.currentActorIdx] = {
                isPlayer: true,
                actorIdx: state.partyBattle.currentActorIdx,
                action: action,
                param: param,
                targetIdx: -1 // ターゲット選択は不要なので -1
            };

            // 🌟 修正：保存したら、即座に全員分揃ったかチェックする
            let allReady = true;
            for (let i = 0; i < state.partyBattle.actions.length; i++) {
                if (state.player[i].hp > 0 && state.partyBattle.actions[i] === null) {
                    allReady = false; break;
                }
            }
            if (allReady) {
                state.partyBattle.actions = state.partyBattle.actions.filter(a => a !== null);
                closeSub();
                if (state.isPvP) onPvPCommandsReady();
                else startPartyTurn();
            } else {
                nextPartyCommand();
            }
            return;

        } else if (action === "escape") {
            state.partyBattle.tempAction = "escape";
            state.partyBattle.tempParam = "none";
            executePartyCommand(-1); return;
        }
    }

    closeSub();
    state.isAnimating = true;
    if (!state.enablePartyBattle && p.rechargeTurn > 0) {
        await showMsg(`${p.name} は 技の反動で動けない！`);
        p.rechargeTurn--;
        await wait(800);
    } else
        if (action === "change") {
            await showMsg(`${p.name} もどれ！<br>ゆけっ！ ${state.player[param].name}！`);
            state.activeP = param;
            state.player[param].isFirstTurn = true;
            state.player[param].turnInBattle = 0;
            state.player[param].turnDice = undefined;

            // 🌟 修正：タクティカルの決闘中（state.tacDataが存在する時）は、
            // 「わざわい」の再発動を禁止する！（盤面登場時に1回だけ発動させるため）
            if (state.player[param].trait === "omen" && !state.tacData) {
                let targetEnemies = state.enablePartyBattle ? state.enemy.filter(en => en.hp > 0) : [e];
                targetEnemies.forEach(en => {
                    const r = Math.floor(Math.random() * 3);
                    if (r === 0) en.curShock = Math.floor(en.curShock / 2);
                    else if (r === 1) en.curHeat = Math.floor(en.curHeat / 2);
                    else en.curElec = Math.floor(en.curElec / 2);
                });
                await showMsg(`【わざわい】 ${state.player[param].name} が 場に現れたことで 相手の耐性が削られた！`);
                playGlitchEffect();
            }

            await updateUI();
            await wait(800);
            await executeAttackSequence(e, [state.player[param]], null, true);
} else if (action === "item") {
            if (p.status === "seal") { await showMsg(`${p.name} は 封印されていて どうぐが 使えない！`); await wait(800); await updateUI(); checkDead(); return; }

            const item = ITEMS[param];
            if (item.effect === "escape" && state.tacData && state.tacData.hasEscapedThisRound) {
                await showMsg(`このラウンドは もう退却できないお！`);
                await wait(800);
                await updateUI();
                state.isAnimating = false;
                setTimeout(() => { const btn = document.getElementById("btn-item"); if (btn) btn.focus(); }, 10);
                return;
            }

            state.inventory[param]--;
            if (state.inventory[param] <= 0) delete state.inventory[param];
            document.getElementById("p-aa").innerText = await resolveAA(item.aa || " "); document.getElementById("p-aa").classList.add("shake");
            await showMsg(`${p.name} は ${item.name} を つかった！`); await wait(800);
            
            if (!state.isPvP && e.hp > 0 && e.trigger_id && e.trigger_id === param) {
                if (e.trigger_scene && SCENARIO[e.trigger_scene]) {
                    await showMsg(`【イベント発生】 ${e.name} に 何かが起きた！`); await wait(800);
                    state.isAnimating = false; saveGame(); jumpTo(e.trigger_scene); return;
                }
            }
            let skipCounter = false;
            
            // 🌟 修正：すべての効果メッセージの後に `await wait(800);` を追加
            if (item.effect === "heal") {
                let h = item.effectPower || 50;
                let wasDead = (p.hp <= 0);
                p.hp = Math.min(p.maxHp, p.hp + h);
                if (wasDead) { p.status = "none"; p.statusTurn = 0; initResistance(p, true); p.chargeSkillId = null; p.rechargeTurn = 0; }
                await showMsg(`HPが回復した！`); await wait(800); 
            }
            else if (item.effect === "heal_mp") {
                let h = item.effectPower || 50;
                let stats = getStats(p, true);
                p.mp = Math.min(stats.maxMp || p.maxMp, p.mp + h);
                await showMsg(`${p.name} の MPが回復した！`); await wait(800); 
            }
            else if (item.effect === "heal_st") {
                let h = item.effectPower || 50;
                let stats = getStats(p, true);
                p.st = Math.min(stats.maxSt || p.maxSt, p.st + h);
                await showMsg(`${p.name} の STが回復した！`); await wait(800); 
            }
            else if (item.effect === "escape") {
                await showMsg(`煙玉！ にげだした！`); await wait(800);
                await processEscapeSuccess(p, e);
                return;
            }
            else if (item.effect === "guarantee_hit") { p.guaranteeHit = true; await showMsg(`次攻撃が【必中】！`); await wait(800); }
            else if (item.effect === "transform_crit") { p.transformCrit = true; await showMsg(`次攻撃が【命中時クリティカル】！`); await wait(800); }
            else if (item.effect === "guarantee_dodge") { p.guaranteeDodge = true; await showMsg(`身代わり人形を 設置した！`); await wait(800); }
            else if (item.effect === "counter") { p.counterActive = true; await showMsg(`反撃の起爆符を 構えた！`); await wait(800); }
            else if (item.effect === "buff") {
                let amt = item.effectPower || 50;
                state.player.forEach(pl => {
                    if (pl.hp > 0) pl.statBuff = Math.min(200, (pl.statBuff || 0) + amt);
                });
                await showMsg(`味方全体のステータスが アップ！`); await wait(800);
            }
            else if (item.effect === "res_up") {
                if (item.id.includes("insulate") || item.id.includes("battery")) p.resUpElec = true;
                if (item.id.includes("oil") || item.id.includes("coolant")) p.resUpShock = true;
                if (item.id.includes("water") || item.id.includes("fireproof")) p.resUpHeat = true;
                await showMsg(`${p.name} の 耐性ゲージが 減りにくくなった！`); await wait(800);
            }
            else if (item.effect === "rec_res") { initResistance(p); await showMsg(`全耐性が 復旧・全回復した！`); await wait(800); }
            else if (item.effect === "damage_fixed") { let d = item.effectPower || 50; e.hp = Math.max(0, e.hp - d); await showMsg(`${item.name} が 炸裂！ ${e.name} に ${d} のダメージ！`); await wait(800); skipCounter = true; }
            else if (item.effect === "cure_status") { p.status = "none"; p.statusTurn = 0; await showMsg(`状態異常が 完全に治った！`); await wait(800); }

            if (state.enableStatus && item.inflict_status && item.inflict_status !== "none") {
                let isSup = ["heal", "cure_status", "rec_res", "buff", "res_up", "guarantee_hit", "transform_crit", "guarantee_dodge", "counter"].includes(item.effect);
                let targetChar = isSup ? p : e;
                targetChar.status = item.inflict_status; 
                targetChar.statusTurn = 4;
                targetChar.statusAppliedTurn = state.turnCount; 
                await showMsg(`${targetChar.name} は 【${STATUS_NAMES[item.inflict_status]}】状態になった！`);
                await wait(800);
            }
            await updateUI(); 
            // 🌟 修正：敵が生きている場合のみ反撃ターンを発生させる
            if (!skipCounter && e.hp > 0) await executeAttackSequence(e, [p], null, true);
        } else if (action === "equip") {
            if (!Array.isArray(p.equips)) p.equips = p.equip ? [p.equip] : [];
            let oldEquip = p.equips[0]; // 🌟今着けている装備を記憶

            // 🌟 1. 外した装備をかばんに戻す
            if (oldEquip && oldEquip !== "none") {
                state.ownedEquips.push(oldEquip);
            }

            // 🌟 2. 新しい装備をかばんから減らし、メッセージを出す
            if (param !== "none") {
                let idx = state.ownedEquips.indexOf(param);
                if (idx !== -1) state.ownedEquips.splice(idx, 1);
                await showMsg(`${p.name} は ${ITEMS[param].name} に 持ち替えた！`);
            } else {
                await showMsg(`${p.name} は 装備を外した！`);
            }

            p.equips[0] = (param === "none") ? null : param; // 🌟 3. スロットを更新
            await updateUI();
            await wait(1000);
            await executeAttackSequence(e, [p], null, true); // 着替え終わったら敵の反撃ターン

        } else if (action === "tension_up") {
            await executeTensionUp(p); // 専用のテンションアップ関数を呼ぶ
            if (e.hp > 0) {
                // 敵の反撃処理
                let eSkillId = getEnemyAction(e);
                let skill = (eSkillId === "normal" || eSkillId === "nothing") ? null : SKILLS[eSkillId];
                if (skill !== "nothing") {
                    await executeAttackSequence(e, [p], skill, false);
                } else {
                    await showMsg(`${e.name} は 様子を見ている……`); await wait(800);
                }
            }
        } else if (action === "escape") {
            await showMsg(`${p.name} は にげだそうとしている！`); await wait(800);
            let escapeRate = 50 + (getStats(p, true).maxDice - getStats(e, false).maxDice);
            escapeRate = Math.max(10, Math.min(90, escapeRate));

            if ((Math.floor(Math.random() * 100) + 1) <= escapeRate) {
                await showMsg(`うまく にげきれた！`); await wait(800);
                await processEscapeSuccess(p, e); // 🌟統一関数へ
                return;
            } else {
                await showMsg(`しかし まわりこまれてしまった！`); await wait(800);
                await executeAttackSequence(e, [p], null, true);
            }
        } else if (action === "scout") {
            await showMsg(`${p.name} は ${e.name} を スカウトしようとしている！`); await wait(800);
            const scoutedCount = state.battleFlags.scoutedList ? state.battleFlags.scoutedList.length : 0;
            if (state.player.length + scoutedCount >= state.maxPlayerCount) {
                await showMsg(`預かり所がいっぱいだお！<br>これ以上 仲間を増やせないお！`); await wait(800);
                if (!state.enablePartyBattle) {
                    const eS = getStats(e, false); const pS = getStats(p, true);
                    let dmg = Math.max(1, (eS.dmg + Math.floor(eS.tech / 10)) - (pS.def + Math.floor(pS.exp / 10)));
                    p.hp = Math.max(0, p.hp - dmg); await showMsg(`${e.name} の 怒りの一撃！\n${p.name} に ${dmg} の ダメージ！`); await wait(800);
                }
                return;
            }
            let rate = 10; rate += (1 - (e.hp / e.maxHp)) * 40;
            if (e.breakShock > 0 || e.breakHeat > 0 || e.breakElec > 0) rate += 20;
            if (e.status && e.status !== "none") rate += 20;

            if ((Math.floor(Math.random() * 100) + 1) <= rate) {
                await showMsg(`やったお！ ${e.name} が 仲間になったお！`); await wait(800);
                e.dropMoney = 0; e.dropExp = 0;
                let newAlly = JSON.parse(JSON.stringify(e));
                const uniqueSeed = Math.floor(Math.random() * 1000000).toString(36);
                newAlly.originalId = e.originalId || e.id.split('_')[0];
                newAlly.id = `${newAlly.originalId}_${Date.now()}_${uniqueSeed}`;
                newAlly.equip = null; newAlly.hp = newAlly.maxHp; newAlly.status = "none"; newAlly.statusTurn = 0;
                initResistance(newAlly, true);

                if (state.isPvP) { state.player.push(newAlly); await updateUI(); }
                else { state.battleFlags.scoutedList = state.battleFlags.scoutedList || []; state.battleFlags.scoutedList.push(newAlly); }
                e.hp = 0; state.battleScoutSuccess = true;
            } else {
                await showMsg(`ダメだお！ ${e.name} は こちらを警戒している！`); await wait(800);
                
                // 🌟 修正：ダイスバトルを省略し、AIが選んだ技を「確定ヒット」の怒りの一撃として放つ！
                if (!state.enablePartyBattle && e.hp > 0 && p.hp > 0) {
                    let eSkillId = getEnemyAction(e);
                    if (eSkillId === "nothing") {
                        await showMsg(`${e.name} は 警戒しながら 様子を見ている……`); await wait(800);
                    } else {
                        let skill = (eSkillId === "normal") ? null : SKILLS[eSkillId];
                        let actionName = skill ? skill.name : "通常攻撃";
                        
                        // 敵を一時的に「必中」状態にして攻撃させる
                        e.guaranteeHit = true; 
                        
                        await showMsg(`＞＞ ${e.name} の 怒りの反撃！ ＜＜`); await wait(800);
                        
                        // ダイスなしの確定攻撃として処理を投げる
                        await executeAttackSequence(e, [p], skill, true);
                    }
                }
            }
        } else if (action === "attack") {
            const skill = param === 'normal' ? null : SKILLS[param];
            const tType = skill ? (skill.target_type || 'enemy_single') : 'enemy_single';
            let targets = [e];
            if (['self', 'ally_single', 'ally_all'].includes(tType)) targets = [p];
            if (tType === 'field_all') targets = [e, p];

            await executeAttackSequence(p, targets, skill, false);
        }

    // 🌟 バトル終了判定
    if (document.getElementById("view-battle").classList.contains("active") === false) {
        isSkipping = false; return;
    }
    if (p.hp <= 0 || e.hp <= 0) {
        await updateUI();
        let isJumped = await checkDead();
        isSkipping = false;
        if (isJumped) return;
        return;
    }

    // 🌟 サポートモードならここでタクティカル盤面に戻る
    if (state.tacData && document.getElementById("view-tactical") && state.tacData.isSupportMode) {
        state.tacData.turn = "player";
        p.hasActed = true;
        state.tacData.isSupportMode = false;
        await returnToTacticalBoard(p, e);
        return;
    }

    // 🌟最重要追加：タクティカルバトル中は、1回殴るたびに世界のターンを進めてはいけない！
    if (state.tacData && document.getElementById("view-tactical")) {
        await updateUI();
        state.isAnimating = false;
        isSkipping = false;
        // ターン終了処理をせずに、ただ次のコマンド入力を待つ
        setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 100);
        return;
    }

    await processAllStatusTurnEnd();
    state.turnCount++;

    if (await checkTOD()) return;

    // 🌟 追加：状態異常（毒・火傷など）でHPが0になった場合の死亡判定
    if (!state.enablePartyBattle) {
        if (await checkDead()) return;
    }

    [...state.player, ...state.enemy].forEach(c => {
        if (c) c.tempEmotion = null;
    });
    await updateUI();

    state.isAnimating = false;
    isSkipping = false;
    setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 100);
};
function consumeEquipItem(char, itemId) {
    if (!itemId) return;

    let consumedFromSlot = false;

    // 🌟 互換性対策：古い equip プロパティが存在し、equips 配列がない場合は自動で配列化する
    if (!Array.isArray(char.equips) && char.equip) {
        char.equips = [char.equip];
    }

    // 1. キャラクターのスロットから「最初の1つだけ」削除
    if (Array.isArray(char.equips)) {
        const slotIdx = char.equips.indexOf(itemId);
        if (slotIdx !== -1) {
            char.equips[slotIdx] = null;
            consumedFromSlot = true;
        }
    }

    // 互換用データも一応消しておく
    if (char.equip === itemId) {
        char.equip = null;
        if (!consumedFromSlot) consumedFromSlot = true;
    }

    // 2. プレイヤーの在庫（ownedEquips）から「最初の1つだけ」削除
    // ※ 味方キャラが装備していた場合のみ在庫を減らす（敵のドロップ品は減らさない）
    if (consumedFromSlot && state.player.includes(char)) {
        const idx = state.ownedEquips.indexOf(itemId);
        if (idx !== -1) {
            state.ownedEquips.splice(idx, 1);
        }
    }
}

async function executeAttackSequence(attacker, defenders, skill, isCounter) {
    const isPlayerAttack = state.player.includes(attacker);
    let targetList = Array.isArray(defenders) ? defenders : [defenders];
    let mainDef = targetList[0];
    let gimmickJumpTo = null;
    let gimmickTriggerName = "";
    let atkTrait = attacker.trait || "none";
    let mainDefTrait = mainDef.trait || "none";
    let killedEnemyInThisAttack = false;
    let snapshotTension = state.enableTension ? (attacker.tension || 0) : 0;

    // 🌟 追加：STとMPの消費処理（システムONの時のみ）
    if (state.enableMpSt && skill && !isCounter) {
        let reqMp = skill.cost_mp || 0;
        let reqSt = skill.cost_st || 0;
        
        // もし順番が回ってきた時にコストが足りなくなっていたら不発にする
        if (attacker.mp < reqMp || attacker.st < reqSt) {
            let lackMsg = attacker.mp < reqMp ? "魔力" : "スタミナ";
            await showMsg(`${attacker.name} は ${skill.name} を放とうとしたが\n${lackMsg}が足りなかった！`);
            attacker.tempEmotion = "ダメージ"; // バテた表情にする
            await updateUI();
            await wait(1000);
            attacker.tempEmotion = null;
            return; // 攻撃をキャンセルして終了
        }
        
        // コストを消費する
        attacker.mp = Math.max(0, attacker.mp - reqMp);
        attacker.st = Math.max(0, attacker.st - reqSt);
        await updateUI(); // ゲージが減るのを見せる
    }

    if (skill && skill.special_effect === "charge_1") {
        if (attacker.chargeSkillId !== skill.id) {
            await showMsg(`${attacker.name} は ${skill.name} のために力を溜めている！`);
            attacker.chargeSkillId = skill.id;
            await wait(1500);
            await updateUI();
            return;
        } else {
            await showMsg(`${attacker.name} は 溜めた力を解き放った！`);
            attacker.chargeSkillId = null;
            await wait(1000);
        }
    }
    attacker.tempEmotion = "攻撃";
    await updateUI();
    resizeAllAAs(); // 🌟 追加：攻撃顔になった瞬間にリサイズ！
    let tType = "enemy_single";
    if (skill && skill.target_type && skill.target_type !== "none") {
        tType = skill.target_type;
    }

    let isSupport = ["ally_single", "ally_all", "self"].includes(tType);
if (!isSupport && targetList.filter(t => t && t.hp > 0).length === 0) {
        // 攻撃技なのに、ターゲットが一人も生きていない（前の人が倒した）場合
        await showMsg(`${attacker.name} は 攻撃しようとしたが 標的がいなかった！`);
        
        // 🚨 非常に重要：ここでも後片付けをしてから帰る
        attacker.tempEmotion = null;
        await updateUI();
        return; 
    }
    if (isSupport) {
        await showMsg(`${skill.name}！`); await wait(800);
        for (let def of targetList) {
            // 🌟回復効果がない技なら、死んでいる対象はスキップする
            if (def.hp <= 0 && (!skill.heal_hp || skill.heal_hp <= 0)) continue;

            if (skill.heal_hp) {
                let wasDead = (def.hp <= 0);

                let healAmount = skill.heal_hp;
                if (atkTrait === "hustle") healAmount = Math.floor(healAmount * 1.5);

                def.hp = Math.min(def.maxHp, def.hp + healAmount);

                if (wasDead) {
                    def.status = "none";
                    def.statusTurn = 0;
                    if (typeof initResistance === 'function') initResistance(def, isPlayerAttack);
                    def.chargeSkillId = null;
                    def.rechargeTurn = 0;
                    def.hasBursted = false;

                    // 生き返ったターンは「行動済み」扱いにして、すぐには動けないようにする
                    def.hasActed = true;
                    resolveTacticalOverlap(def); 
                }
                await showMsg(`${def.name} の HPが ${healAmount} 回復！`); await wait(800);
            }

            // 状態異常の解除と、耐性全回復の処理
            if (skill.special_effect) {
                if (skill.special_effect === "cure_status" && def.hp > 0 && def.status !== "none") {
                    def.status = "none";
                    def.statusTurn = 0;
                    await showMsg(`${def.name} の 状態異常が 完全に治った！`);
                    await wait(800);
                }
                if (skill.special_effect === "rec_res" && def.hp > 0 && state.enableResistance) {
                    if (typeof initResistance === 'function') initResistance(def, isPlayerAttack);
                    await showMsg(`${def.name} の 全耐性が 復旧・全快した！`);
                    await wait(800);
                }
            }

            // 蘇生した後にバフ（状態異常）をかける処理を続ける
            let inflictStatus = skill.inflict_status || "none";
            if (inflictStatus !== "none" && def.hp > 0 && def.status !== inflictStatus) {
                def.status = inflictStatus; def.statusTurn = 4;
                await showMsg(`${def.name} は 【${STATUS_NAMES[inflictStatus]}】状態になった！`); await wait(800);
            }
        }
        await updateUI();
        return;
    }


    if (atkTrait === "mold_breaker" && ["metal_body", "sturdy", "levitate", "magic_bounce", "ultra_body", "wonder_guard", "hard_body", "evasion_step", "gamble_body"].includes(mainDefTrait)) {
        mainDefTrait = "none"; await showMsg(`${attacker.name} は かたやぶり だ！\n相手の特性を無視する！`); await wait(800);
    }

    if (mainDef.counterActive) {
        await showMsg(`${attacker.name} の攻撃！<br>しかし！ 反撃の起爆符 が発動！`); await wait(800);
        const pS = getStats(mainDef, true, atkTrait); // (※isPlayer引数はアバウトでOKです)
        const counterDmg = pS.dmg * 2;
        attacker.hp = Math.max(0, attacker.hp - counterDmg);
        await updateUI();
        await showMsg(`起爆符が炸裂！！<br>${attacker.name} に ${counterDmg} の ダメージ！`);
        mainDef.counterActive = false; // 🌟修正：1回で消費
        await wait(800);
        if (attacker.hp <= 0) return;
    }
    const atkStats = getStats(attacker, isPlayerAttack, mainDefTrait);
    const defStats = getStats(mainDef, !isPlayerAttack, atkTrait);
    let battleDiceMod = (skill && skill.battle_dice_mod) ? skill.battle_dice_mod : 1.0;
    if (attacker.status === "sleep") battleDiceMod *= 0.5;

if (!isCounter && !state.enablePartyBattle) {
        // 🌟 修正：戦闘開始前のメッセージ
        await showMsg(skill ? `${skill.name}！` : `通常攻撃！`);

        document.getElementById("dice-battle-ui").style.display = "block";
        document.getElementById("dice-hit-ui").style.display = "none";
        document.getElementById("dice-board").style.display = "block";

        const pValEl = document.getElementById("bd-p-val"), eValEl = document.getElementById("bd-e-val");
        pValEl.className = "d-val"; eValEl.className = "d-val";
        document.getElementById("bd-p-name").innerText = state.player[state.activeP].name;
        document.getElementById("bd-e-name").innerText = state.enemy[state.activeE].name;
        document.getElementById("bd-p-max").innerText = isPlayerAttack ? atkStats.maxDice : defStats.maxDice;
        document.getElementById("bd-e-max").innerText = isPlayerAttack ? defStats.maxDice : atkStats.maxDice;

        let rP = 0, rE = 0;
        rP = Math.floor(Math.random() * (isPlayerAttack ? atkStats.maxDice : defStats.maxDice)) + 1;
        rE = Math.floor(Math.random() * (isPlayerAttack ? defStats.maxDice : atkStats.maxDice)) + 1;
        if (isPlayerAttack) rP = Math.max(1, Math.floor(rP * battleDiceMod)); else rE = Math.max(1, Math.floor(rE * battleDiceMod));
        isSkipping = false; 
        let loopCount = state.skipHitDice ? 0 : 20;
        for (let i = 0; i < loopCount; i++) {
            if (isSkipping) break;
            pValEl.innerText = Math.floor(uiRandom() * 100); 
            eValEl.innerText = Math.floor(uiRandom() * 100);
            await wait(40);
        }

        pValEl.innerText = rP; eValEl.innerText = rE;

        // 状態異常・特性による補正
        if (state.enableResistance) { if (state.player[state.activeP].breakShock > 0) rP = 1; if (state.enemy[state.activeE].breakShock > 0) rE = 1; }
        if (state.player[state.activeP].status === "stone") rP = 0; if (state.enemy[state.activeE].status === "stone") rE = 0;
        if (state.player[state.activeP].rechargeTurn > 0) rP = 0;
        if (state.enemy[state.activeE].rechargeTurn > 0) rE = 0;
        if (attacker.guaranteeHit) {
            if (isPlayerAttack) { rP = 999; rE = 1; } else { rE = 999; rP = 1; }
        }

        let pPre = (isPlayerAttack && atkTrait === "preemptive" && attacker.isFirstTurn) || (!isPlayerAttack && mainDefTrait === "preemptive" && mainDef.isFirstTurn);
        let ePre = (!isPlayerAttack && atkTrait === "preemptive" && attacker.isFirstTurn) || (isPlayerAttack && mainDefTrait === "preemptive" && mainDef.isFirstTurn);

        if (pPre && !ePre) {
            rP = 999; rE = 1;
            await showMsg(`【さきがけ】 神速の行動！`); await wait(800);
        } else if (!pPre && ePre) {
            rP = 1; rE = 999;
            await showMsg(`【さきがけ】 神速の行動！`); await wait(800);
        }

        if (atkTrait === "lucky") {
            if (isPlayerAttack) rP = Math.max(rP, Math.max(1, Math.floor(atkStats.maxDice * 0.2)));
            else rE = Math.max(rE, Math.max(1, Math.floor(atkStats.maxDice * 0.2)));
        }
        if (mainDefTrait === "lucky") {
            if (isPlayerAttack) rE = Math.max(rE, Math.max(1, Math.floor(defStats.maxDice * 0.2)));
            else rP = Math.max(rP, Math.max(1, Math.floor(defStats.maxDice * 0.2)));
        }

        pValEl.innerText = rP; eValEl.innerText = rE;

        // 🌟 修正：振ったダイスの結果を消えないようにキャラに記憶させる！
        state.player[state.activeP].turnDice = rP;
        state.enemy[state.activeE].turnDice = rE;

        isSkipping = false;

        if (mainDefTrait === "pressure" && state.enableResistance) {
            attacker.curShock = Math.max(0, attacker.curShock - 5);
            attacker.curHeat = Math.max(0, attacker.curHeat - 5);
            attacker.curElec = Math.max(0, attacker.curElec - 5);
            await showMsg(`【プレッシャー】 ${mainDef.name} の威圧感で ${attacker.name} の耐性が削られた！`);
            await wait(800);
            await updateUI();
        }

        let isReversed = (attacker.status === "reverse") !== (mainDef.status === "reverse");
        let attackerWon = isReversed ? (isPlayerAttack ? (rP < rE) : (rE < rP)) : (isPlayerAttack ? (rP > rE) : (rE > rP));
        
        if (rP === rE) { 
            await showMsg(`おたがいの こうげきが はじかれた！`); 
            await wait(800); 
            document.getElementById("dice-board").style.display = "none"; 
            return; 
        }

        // ==========================================
        // 🌟 修正：危険な一本道をやめ、安全な「やり直し（再帰）」に戻す
        // ==========================================
        if (!attackerWon) {
            // 【仕掛けた側が負けた場合】
            (isPlayerAttack ? eValEl : pValEl).classList.add("dice-winner"); 
            await showMsg(`＞＞ ${mainDef.name} が 競り勝った！ ＜＜`); 
            
            // 🌟 ボードを消してタメを作る（これで画面が重ならない）
            await wait(800);
            document.getElementById("dice-board").style.display = "none";

            let counterSkill = null;
            let counterTargets = [attacker];

            if (!isPlayerAttack) {
                // 味方が競り勝った場合は通常攻撃で反撃
            } else {
                // 敵が競り勝った場合はAIで技を決める
                let eSkillId = getEnemyAction(mainDef);
                if (eSkillId === "nothing") {
                    await showMsg(`${mainDef.name} は 不敵に笑っている……`); 
                    await wait(800); 
                    return;
                }
                if (mainDef.status === "stone" || mainDef.status === "sleep" || mainDef.hp <= 0) {
                    await showMsg(`${mainDef.name} は 動けない！`);
                    await wait(800);
                    return;
                }
                counterSkill = eSkillId === "normal" ? null : SKILLS[eSkillId];
                let eTargetType = counterSkill ? (counterSkill.target_type || 'enemy_single') : 'enemy_single';
                if (['self', 'ally_single', 'ally_all'].includes(eTargetType)) counterTargets = [mainDef];
            }

            // 🌟 安全に「勝った側の攻撃」として最初からやり直す！
            await executeAttackSequence(mainDef, counterTargets, counterSkill, true);
            return; // 負けた側の処理はここで完全終了
        }

        // 【仕掛けた側が順当に勝った場合】
        (isPlayerAttack ? pValEl : eValEl).classList.add("dice-winner"); 
        await showMsg(`＞＞ ${attacker.name} の しょうり！ ＜＜`); 
        
        await wait(800);
        // (ここではボードを消さず、下の命中ダイスへスライドさせる)

        if (attacker.status === "confusion") {
            let selfStats = getStats(attacker, isPlayerAttack, mainDefTrait);
            let selfDmg = Math.max(1, selfStats.dmg);
            attacker.hp = Math.max(0, attacker.hp - selfDmg);
            document.getElementById("dice-board").style.display = "none";
            await showMsg(`＞＞ ${attacker.name} は 混乱して 自身を攻撃！ ＜＜`);
            await wait(1500);
            await updateUI();
            return;
        
        
        }
        
        // （ここで VSボード がそのまま 命中1d10ボード へと書き換わる準備が整う）

    } else {
        // 🌟 （以下、パーティーバトル用のブロックはそのまま）
        if (state.enablePartyBattle && attacker.status === "confusion" && Math.random() < 0.5) {
            let selfDmg = Math.max(1, atkStats.dmg);
            attacker.hp = Math.max(0, attacker.hp - selfDmg);
            await showMsg(`＞＞ ${attacker.name} は 混乱して 自身を攻撃！ ＜＜`);
            await wait(800);
            await updateUI();
            return; 
        }

        // 🌟 修正：「反撃」という言葉を抹消し、選んだ技の名前を堂々と表示する
        let actionName = skill ? skill.name : "通常攻撃";
        await showMsg(`${attacker.name} の ${actionName}！`);
        await wait(800); 
    }

    if (mainDef.guaranteeDodge) {
        await showMsg(`＞＞ 【身代わり人形】が 攻撃を完全に防いだ！ ＜＜`);
        mainDef.guaranteeDodge = false;
        await wait(800);
        return;
    }

    let aDice = attacker.turnDice || atkStats.maxDice;
    let dDice = mainDef.turnDice || defStats.maxDice;

    let actualDiff = aDice - dDice;
    let hitRate = 20 + actualDiff;
    hitRate = Math.max(10, Math.min(100, hitRate));

    let hitDiceMod = (skill && skill.hit_dice_mod) ? skill.hit_dice_mod : 0;
    if (mainDefTrait === "evasion_step") hitDiceMod -= 2;
    if (atkTrait === "demon_strike") hitDiceMod -= 3;
    if (attacker.status === "paralysis") hitDiceMod -= 3;
    if (mainDef.status === "freeze") hitDiceMod += 3;
    if (attacker.status === "focus") hitDiceMod += 1;
    if (atkTrait === "insight") hitDiceMod += 2;
    if (atkTrait === "dash") hitDiceMod += Math.max(0, 6 - (attacker.turnInBattle || 0));
    if (atkTrait === "late_bloomer") hitDiceMod += Math.min(6, -3 + (attacker.turnInBattle || 0));

    let currentSkillId = skill ? skill.id : "normal";
    if (attacker.lastUsedSkill === currentSkillId) { attacker.skillUseCount = (attacker.skillUseCount || 0) + 1; }
    else { attacker.lastUsedSkill = currentSkillId; attacker.skillUseCount = 1; }

    if (atkTrait === "mastery" && attacker.skillUseCount > 1) {
        let bonus = (attacker.skillUseCount - 1) * 2; hitDiceMod += bonus;
    }
    if (atkTrait === "pursuit" && attacker.hitCombo > 0) {
        hitDiceMod += attacker.hitCombo;
    }

    let finalHitRate = hitRate + (hitDiceMod * 10);
    if (mainDef.status === "dodge") finalHitRate = Math.floor(finalHitRate / 2);

    let roll, isHit, isCrit;

    if (!isPlayerAttack && mainDef.turnDice === undefined) {
        // 交代直後なら、ダイスを振らずに「命中」を確定させる
        roll = 1; // 後の計算用のダミー値
        isHit = true;
        isCrit = false;
    } 
    // それ以外の通常時は、今まで通りダイスを振る
    else if (state.enablePartyBattle) {
        let successThreshold = Math.min(10, Math.max(1, Math.floor(finalHitRate / 10)));
        roll = Math.floor(Math.random() * 10) + 1;
        isCrit = (roll === 10);
        isHit = isCrit || (roll <= successThreshold);
    } else {
        let diceResult = await roll1d10Dice("命中判定", finalHitRate, "命中", "回避", true);
        roll = diceResult.roll;
        isHit = diceResult.isSuccess;
        isCrit = diceResult.isCrit;
    }

    if (atkTrait === "crit_up" && roll >= 9) isCrit = true;
    if (atkTrait === "demon_strike" && roll >= 7) isCrit = true;
    if (atkTrait === "pinch_crit" && (attacker.hp / attacker.maxHp) <= 0.25 && roll >= 5) isCrit = true;

    if (attacker.status === "charm") isHit = isCrit;
    if (attacker.guaranteeHit) { isHit = true; attacker.guaranteeHit = false; }
    if (attacker.transformCrit && isHit) { isCrit = true; attacker.transformCrit = false; }
    if (attacker.status === "surehit" || mainDef.status === "surehit") { isHit = true; isCrit = true; }

    if (!isPlayerAttack && mainDef.turnDice === undefined) {
        isHit = true; 
        // 攻撃が当たった理由をログに出すと親切です
        await showMsg(`<span style="color:#e53e3e;">交代直後の ${mainDef.name} は 隙だらけだ！</span>`);
        await wait(800);
    }

    if (isHit && mainDef.guaranteeDodge) {
        await showMsg(`＞＞ 【身代わり人形】が 攻撃を完全に防いだ！ ＜＜`);
        mainDef.guaranteeDodge = false;
        await wait(800);
        isHit = false;
    }

    // 🌟 修正：結果をポップアップさせる関数（ローカル関数）
    const showPopup = (targetId, text, color) => {
        let popupEl = document.getElementById(`popup-${targetId}`);
        if (popupEl) {
            popupEl.innerText = text;
            popupEl.style.color = color;
            popupEl.className = "hit-popup";
            popupEl.style.display = "block";
            // アニメーションを再起動させるためのトリック
            popupEl.style.animation = "none";
            popupEl.offsetHeight;
            popupEl.style.animation = "popupAnim 0.8s forwards";

            setTimeout(() => { popupEl.style.display = "none"; }, 800);
        }
    };
if (!state.enablePartyBattle) {
        document.getElementById("dice-board").style.display = "none";
    }
    if (isHit) {
        if (isCrit) {
            playGlitchEffect();
            if (state.enablePartyBattle) showPopup(mainDef.id, "CRITICAL!!", "#ecc94b");
            else {
                await showMsg(`＞＞ ${attacker.name} の 痛恨の一撃！！ ＜＜`);
                await wait(800); // 🌟 統一
            }
        } else {
            flash();
            if (state.enablePartyBattle) showPopup(mainDef.id, "HIT!", "#ffffff");
            else {
                // 🌟 ボードが消えた後、一呼吸置いてからダメージ計算へ
                await wait(800); 
            }
        }
        attacker.hitCombo = (attacker.hitCombo || 0) + 1;

        for (let def of targetList) {
            // ターゲットにトリガーが設定されていて、当てた技のID または 装備している武器のID と一致するか？
            if (def.trigger_id && (def.trigger_id === currentSkillId || def.trigger_id === attacker.equip)) {
                if (def.trigger_scene && SCENARIO[def.trigger_scene]) {
                    await showMsg(`【イベント発生】 ${def.name} に 何かが起きた！`);
                    await wait(800);
                    state.isAnimating = false;
                    saveGame();
                    jumpTo(def.trigger_scene); // 戦闘を中断してイベントシーンへ！
                    return;
                }
            }
        }

        let isFinisherInstaKill = false;
        if (isCrit) {
            attacker.critCount = (attacker.critCount || 0) + 1;
            if (atkTrait === "finisher" && attacker.critCount >= 3) {
                isFinisherInstaKill = true; // とどめ発動フラグ
            }
        }
        let totalDmgDealt = 0;
        if (skill && skill.special_effect) {
            if (skill.special_effect === "escape_battle") {

                // 🌟 ここを追加：逃走する前に表情を元に戻す
                attacker.tempEmotion = null;
                targetList.forEach(t => { if (t) t.tempEmotion = null; });

                if (isPlayerAttack) {
                    await showMsg(`${attacker.name} は 戦線から離脱した！`); await wait(800);

                    if (typeof processEscapeSuccess === "function") {
                        await processEscapeSuccess(attacker, targetList[0]);
                    }
                } else {
                    // 敵側の逃走処理（はぐれメタル）
                    await showMsg(`${attacker.name} は 逃げ去ってしまった！`); await wait(800);
                    attacker.hp = 0;
                    attacker.dropMoney = 0;
                    attacker.dropExp = 0; // 報酬ゼロで消滅
                }
                await updateUI();
                return; // ダメージ計算などを行わずに終了
            }
            for (let def of targetList) {
                if (def.hp <= 0) continue;
                if (def.isBoss === "true" && ["sync_hp", "sync_res", "transfer_status"].includes(skill.special_effect)) {
                    await showMsg(`しかし ${def.name} には 効かなかった！`);
                    await wait(800);
                    continue;
                }
                if (skill.special_effect === "sync_hp") {
                    let myHpPer = attacker.hp / attacker.maxHp;
                    def.hp = Math.max(1, Math.floor(def.maxHp * myHpPer));
                    await showMsg(`【痛み分け】 ${def.name} のHPが ${attacker.name} と同じ割合になった！`);
                    await wait(800);
                }
                else if (skill.special_effect === "sync_res" && state.enableResistance) {
                    let aStats = getStats(attacker, isPlayerAttack);
                    let dStats = getStats(def, !isPlayerAttack);
                    let sPer = attacker.curShock / (aStats.maxShock || 100);
                    let hPer = attacker.curHeat / (aStats.maxHeat || 100);
                    let ePer = attacker.curElec / (aStats.maxElec || 100);
                    def.curShock = Math.max(0, Math.floor((dStats.maxShock || 100) * sPer));
                    def.curHeat = Math.max(0, Math.floor((dStats.maxHeat || 100) * hPer));
                    def.curElec = Math.max(0, Math.floor((dStats.maxElec || 100) * ePer));
                    await showMsg(`【耐性同調】 ${def.name} の耐性ゲージが ${attacker.name} と同じ割合に落ち込んだ！`);
                    await wait(800);
                }
                else if (skill.special_effect === "transfer_status") {
                    if (attacker.status && attacker.status !== "none" && attacker.status !== "doom") {
                        def.status = attacker.status; def.statusTurn = attacker.statusTurn;
                        attacker.status = "none"; attacker.statusTurn = 0;
                        await showMsg(`【異常転移】 ${attacker.name} は 自身の状態異常を ${def.name} になすりつけた！`);
                        await wait(800);
                    } else {
                        showMsg(`しかし 移す状態異常が なかった！`);
                        await wait(800);
                    }
                }
                else if (skill.special_effect === "cure_status" && def.status !== "none") {
                    def.status = "none";
                    def.statusTurn = 0;
                    await showMsg(`${def.name} の 状態異常が 完全に治った！`);
                    await wait(800);
                }
                else if (skill.special_effect === "rec_res" && state.enableResistance) {
                    // 敵側を回復させるため、isPlayerAttackを反転させます
                    if (typeof initResistance === 'function') initResistance(def, !isPlayerAttack);
                    await showMsg(`${def.name} の 全耐性が 復旧・全快した！`);
                    await wait(800);
                }

            } // ← (for let def of targetList の閉じカッコ)
            attacker.tempEmotion = null;
            // 特殊効果技はダメージ計算をスキップして終了する
            await updateUI(); return;
        }
        // 🌟 ターゲットリスト全員にダメージと効果を適用するループ
        for (let def of targetList) {
            if (def.hp <= 0) continue;

            let currentDefTrait = def.trait || "none";
            // 🌟変更：かたやぶりの無効化対象に「反射・吸収系（三倍返し等）」「ダメージ軽減系」「プレッシャー等」をすべて追加
            const ignoreTraits = [
                "metal_body", "sturdy", "levitate", "magic_bounce", "ultra_body", "wonder_guard",
                "hard_body", "evasion_step", "gamble_body", "iron_wall", "pressure",
                "triple_mirror", "status_mirror", "break_mirror", // 反射系
                "gourmet_body", "energy_convert", "overflow", "reverse_affinity" // 🌟 追加：あべこべ（属性反転）も貫通対象にする
            ];
            if (atkTrait === "mold_breaker" && ignoreTraits.includes(currentDefTrait)) {
                currentDefTrait = "none";
                await showMsg(`${attacker.name} は かたやぶり だ！\n相手の防御・反射特性を無視する！`);
                await wait(1000);
            }

            if (currentDefTrait === "pressure" && state.enableResistance) {
                const aStats = getStats(attacker, isPlayerAttack); 
                let pShockDrop = Math.max(1, Math.floor((aStats.maxShock || 100) * 0.05));
                let pHeatDrop = Math.max(1, Math.floor((aStats.maxHeat || 100) * 0.05));
                let pElecDrop = Math.max(1, Math.floor((aStats.maxElec || 100) * 0.05));

                attacker.curShock -= pShockDrop;
                attacker.curHeat -= pHeatDrop;
                attacker.curElec -= pElecDrop;

                let pBreakMsg = "";
                // 衝撃ブレイク
                if (attacker.curShock <= 0 && attacker.breakShock <= 0) { 
                    attacker.curShock = 0; 
                    let rev = attacker.revShock || 2; if (attacker.status === "stagnate") rev *= 2; 
                    attacker.breakShock = rev;
                    attacker.breakShockTurn = state.turnCount; // 🌟 
                    pBreakMsg += "衝 "; 
                }
                // 熱量ブレイク
                if (attacker.curHeat <= 0 && attacker.breakHeat <= 0) { 
                    attacker.curHeat = 0; 
                    let rev = attacker.revHeat || 2; if (attacker.status === "stagnate") rev *= 2; 
                    attacker.breakHeat = rev;
                    attacker.breakHeatTurn = state.turnCount; // 🌟 
                    pBreakMsg += "熱 "; 
                }
                // 電磁ブレイク
                if (attacker.curElec <= 0 && attacker.breakElec <= 0) { 
                    attacker.curElec = 0; 
                    let rev = attacker.revElec || 2; if (attacker.status === "stagnate") rev *= 2; 
                    attacker.breakElec = rev;
                    attacker.breakElecTurn = state.turnCount; // 🌟 
                    pBreakMsg += "電 "; 
                }

                await showMsg(`【プレッシャー】 ${def.name} の威圧感で ${attacker.name} の耐性が削られた！`);
                if (pBreakMsg) {
                    await wait(800);
                    await showMsg(`<span style="color:#e53e3e; font-weight:bold;">${attacker.name} の ${pBreakMsg}がブレイク！！</span>`);
                }
                await wait(400);
                await updateUI();
            }

            let isDefPlayer = state.player.includes(def);
            const cDefStats = getStats(def, isDefPlayer, atkTrait);
            let targetIsCrit = isCrit;
            if (currentDefTrait === "iron_wall" && targetIsCrit) {
                targetIsCrit = false;
                await showMsg(`【てっぺき】 ${def.name} は 急所を防いだ！`); await wait(800);
            }

            let defVal = cDefStats.def + Math.floor(cDefStats.exp / 10);
            if (currentDefTrait === "def_gamble") {
                if (Math.random() < 0.5) {
                    defVal *= 2; await showMsg(`【防御ギャンブル】 大当たり！ ${def.name}の防御力が2倍！`); await wait(800);
                } else {
                    defVal = Math.floor(defVal * 0.5); await showMsg(`【防御ギャンブル】 ハズレ！ ${def.name}の防御力が半減！`); await wait(800);
                }
            }

            if (state.enableResistance && def.breakHeat > 0) defVal = 0;
            if (def.status === "frostbite") defVal = Math.floor(defVal / 2);
            if (def.status === "harden") defVal *= 2;

            let dmg_multiplier = (skill && skill.dmg_mod) ? skill.dmg_mod : 1.0;
            if (atkTrait === "guts" && attacker.status !== "none") dmg_multiplier *= 1.5;
            if (attacker.status === "aggressive") dmg_multiplier *= 2;
            if (atkTrait === "surprise" && attacker.isFirstTurn) dmg_multiplier *= 2;

            // 🌟 追加：憤怒（与ダメージ3倍）
            if (attacker.status === "rage") dmg_multiplier *= 3;

            if (atkTrait === "adversity") {
                let hpPer = attacker.hp / attacker.maxHp;
                if (hpPer <= 0.25) dmg_multiplier *= 1.75;
                else if (hpPer <= 0.50) dmg_multiplier *= 1.5;
            }

            let atkVal = atkStats.dmg + Math.floor(atkStats.tech / 10);
            if (atkTrait === "atk_gamble") {
                if (Math.random() < 0.5) {
                    atkVal *= 2; await showMsg(`【攻撃ギャンブル】 大当たり！ ${attacker.name}の攻撃力が2倍！`); await wait(800);
                } else {
                    atkVal = Math.floor(atkVal * 0.5); await showMsg(`【攻撃ギャンブル】 ハズレ！ ${attacker.name}の攻撃力が半減！`); await wait(800);
                }
            }

            // 🌟 追加・修正：ダメージ計算前に「スナップショットのテンション」を一時的に持たせる
            if (state.enableTension) {
                attacker.tempTensionForCalc = snapshotTension;
            }

            let dmg = calculateDamage(attacker, def, skill, targetIsCrit);

            // 🌟 追加：計算が終わったら一時的なテンションを消去する
            if (state.enableTension) {
                delete attacker.tempTensionForCalc;
            }

            if (currentDefTrait === "perfect_guard" && targetIsCrit) {
                await showMsg(`【会心完全ガード】 ${def.name} は 急所への一撃を 完全に無効化した！`); await wait(800);
                dmg = 0; // メッセージを出すためにここで0を再代入（関数内でも0になっているが演出用）
            }

            let attackElements = [];
            if (skill && skill.atk_element && skill.atk_element !== "none") {
                attackElements.push(skill.atk_element);
            } else {
                let eqList = Array.isArray(attacker.equips) ? attacker.equips : (attacker.equip ? [attacker.equip] : []);
                eqList.forEach(eid => {
                    if (eid && ITEMS[eid] && ITEMS[eid].atk_element && ITEMS[eid].atk_element !== "none") {
                        if (!attackElements.includes(ITEMS[eid].atk_element)) attackElements.push(ITEMS[eid].atk_element);
                    }
                });
            }

            let isWeak = false, isResist = false, isNull = false, isRepel = false, isAbsorb = false;
            let eleNames = [];

            if (state.enableAttribute && attackElements.length > 0) {
                attackElements.forEach(elem => {
                    const eIdx = ATTR_KEYS.indexOf(elem);
                    if (eIdx !== -1) eleNames.push(ATTR_NAMES[eIdx]);

                    let affinity = getFinalAffinity(def, elem, atkTrait);

                    if (currentDefTrait === "battery" && elem === "elec") {
                        affinity = "nu";
                        def.batteryTriggered = true;
                    }

                    if (affinity === "ab") isAbsorb = true;
                    else if (affinity === "rp") isRepel = true;
                    else if (affinity === "nu") isNull = true;
                    else if (affinity === "wk") { dmg = Math.floor(dmg * 1.5); isWeak = true; }
                    else if (affinity === "hl") { dmg = Math.max(1, Math.floor(dmg * 0.75)); isResist = true; }
                    else if (affinity === "rs") { dmg = Math.max(1, Math.floor(dmg * 0.5)); isResist = true; }
                });
                await showMsg(`【${eleNames.join("・")}】属性の攻撃！`); await wait(800);
            }

            if (def.status === "invincible") dmg = 0;
            else if (currentDefTrait === "metal_body" && !isCrit && !isAbsorb && !isNull && !isRepel) dmg = 1;
            else if (currentDefTrait === "wonder_guard" && !isWeak) dmg = 0;
            else if (currentDefTrait === "gamble_body" && Math.random() < 0.5) {
                dmg = 0;
                await showMsg(`【ギャンブル】 ${def.name} は 運良くダメージを免れた！`); await wait(800);
            }

            if (currentDefTrait === "hard_body" && dmg > 0 && !isAbsorb && !isNull && !isRepel) {
                dmg = Math.max(1, Math.floor(dmg / 3));
            }

            // ▼ ここからが「ダメージ適用」ブロック ▼
            if (isRepel) {
                let repelDmg = currentDefTrait === "triple_mirror" ? dmg * 3 : dmg;

                // 🌟 修正：共通関数を呼ぶ
                await applyDamage(def, attacker, repelDmg, isDefPlayer, false);
                await showMsg(`${def.name} は はねかえした！\n${attacker.name} に 反射ダメージ！`);

                if (currentDefTrait === "status_mirror" && attacker.hp > 0 && attacker.status === "none") {
                    const randomStatus = ["poison", "burn", "paralysis", "freeze", "confusion", "bleed"][Math.floor(Math.random() * 6)];
                    attacker.status = randomStatus; attacker.statusTurn = 3;
                    await wait(800);
                    await showMsg(`【おまけ反射】 ${attacker.name} は ${STATUS_NAMES[randomStatus]} になってしまった！`);
                }

                if (currentDefTrait === "break_mirror" && attacker.hp > 0 && state.enableResistance) {
                    const aStats = getStats(attacker, isPlayerAttack);
                    let bmShockDrop = Math.max(1, Math.floor((aStats.maxShock || 100) * 0.10));
                    let bmHeatDrop = Math.max(1, Math.floor((aStats.maxHeat || 100) * 0.10));
                    let bmElecDrop = Math.max(1, Math.floor((aStats.maxElec || 100) * 0.10));

                    attacker.curShock = Math.max(0, attacker.curShock - bmShockDrop);
                    attacker.curHeat = Math.max(0, attacker.curHeat - bmHeatDrop);
                    attacker.curElec = Math.max(0, attacker.curElec - bmElecDrop);
                    await wait(800);
                    await showMsg(`【ブレイク反射】 ${def.name} が ${attacker.name} の耐性を削り取った！`);
                    await updateUI();
                }
                await wait(800);

            } else if (isAbsorb) {
                let absorbHp = currentDefTrait === "gourmet_body" ? dmg * 3 : dmg;

                if (currentDefTrait === "overflow" && def.hp >= def.maxHp) {
                    let allies = isPlayerAttack ? state.enemy : state.player.slice(0, state.battleMemberCount || 3);
                    let overflowMsg = false;
                    allies.forEach(a => {
                        if (a.hp > 0 && a.hp < a.maxHp) {
                            a.hp = Math.min(a.maxHp, a.hp + Math.floor(absorbHp / 2));
                            overflowMsg = true;
                        }
                    });
                    if (overflowMsg) {
                        await showMsg(`【オーバーフロー】 ${def.name} は 溢れたエネルギーで 味方全体を回復した！`);
                    } else {
                        await showMsg(`${def.name} は 吸収した！\nしかし HPは すでに満タンだ！`);
                    }
                } else {
                    def.hp = Math.min(def.maxHp, def.hp + absorbHp);
                    await showMsg(`${def.name} は 吸収した！\nHPが ${absorbHp} かいふく！`);
                }

                if (currentDefTrait === "energy_convert" && state.enableResistance) {
                    const dStats = getStats(def, !isPlayerAttack);
                    let ecShockHeal = Math.max(1, Math.floor((dStats.maxShock || 100) * 0.15));
                    let ecHeatHeal = Math.max(1, Math.floor((dStats.maxHeat || 100) * 0.15));
                    let ecElecHeal = Math.max(1, Math.floor((dStats.maxElec || 100) * 0.15));

                    def.curShock = Math.min(dStats.maxShock || 100, def.curShock + ecShockHeal);
                    def.curHeat = Math.min(dStats.maxHeat || 100, def.curHeat + ecHeatHeal);
                    def.curElec = Math.min(dStats.maxElec || 100, def.curElec + ecElecHeal);
                    await wait(800);
                    await showMsg(`【エナジー変換】 ${def.name} は エネルギーを変換し 全耐性を回復した！`);
                    await updateUI();

                }
                await wait(800);

            } else if (isNull) {
                await showMsg(`${def.name} には 効果がないようだ……`);
                if (def.batteryTriggered) {
                    def.batteryTriggered = false;
                    initResistance(def, !isPlayerAttack);
                    await wait(800);
                    await showMsg(`【じゅうでん】 ${def.name} は電撃を吸収して 全耐性を全快した！`);
                    await updateUI();
                }
            } else {
                // 🌟 修正：共通関数を呼ぶだけで、とどめ・食いしばり・自爆がすべて処理される！
                if (isFinisherInstaKill) {
                    attacker.critCount = 0;
                    playGlitchEffect();
                    await showMsg(`<span style="color:#e53e3e; font-weight:bold;">【とどめ】の一撃！！</span>`); await wait(800);
                }

                if (isWeak) { await showMsg(`<span style="color:#e53e3e; font-weight:bold;">WEAK POINT!! 弱点を突いた！</span>`); playGlitchEffect(); await wait(800); }
                else if (isResist) { await showMsg(`効果は いまひとつのようだ……`); await wait(800); }

                // ダメージ適用（ここで死亡・自爆・食いしばり判定が走る）
                 let dmgResult = await applyDamage(attacker, def, dmg, isDefPlayer, isFinisherInstaKill);

                if (state.enableTension && dmgResult.actualDmg > 0) {
                    let currentDefTrait = def.trait || "none";

                    // ダウンボディ：攻撃してきた相手のテンションを -5
                    if (currentDefTrait === "down_body") {
                        await changeTension(attacker, -5, `【ダウンボディ】 ${def.name} に触れたせいで、`);
                    }

                    // ヒートアップ：クリティカルを受けた時にテンションを +25
                    if (targetIsCrit && currentDefTrait === "heat_up") {
                        await changeTension(def, 25, `【ヒートアップ】 急所を突かれた怒りで、`);
                    }
                }


                if (dmgResult.isDead) {
                    killedEnemyInThisAttack = true;
                }
                totalDmgDealt += dmgResult.actualDmg;

                // 🌟 状態異常ボディ系
                if (state.enableStatus && !dmgResult.isDead && attacker.hp > 0 && dmgResult.actualDmg > 0) {
                    let bodyStatus = "none";  let bodyName = ""; let relatedAttr = "none";
                    if (currentDefTrait === "paralysis_body") { bodyStatus = "paralysis"; bodyName = "ビリビリボディ"; relatedAttr = "elec"; }
                    else if (currentDefTrait === "fire_body") { bodyStatus = "burn"; bodyName = "こうねつボディ"; relatedAttr = "fire"; }
                    else if (currentDefTrait === "poison_body") { bodyStatus = "poison"; bodyName = "どくどくボディ"; relatedAttr = "grass"; }

                    if (bodyStatus !== "none" && attacker.status !== bodyStatus) {
                        if (!isStatusOverwritable(attacker.status)) continue;
                        let successRate = 75;
                        // 🌟修正: 第3引数に "none" ではなく currentDefTrait を渡し、特性(かたやぶり等)の干渉を許可
                        const aff = getFinalAffinity(attacker, relatedAttr, currentDefTrait);
                        switch (aff) { case "wk": successRate = 100; break; case "hl": successRate = 50; break; case "rs": successRate = 25; break; case "nu": case "rp": case "ab": successRate = 0; break; }

                        if ((Math.floor(Math.random() * 100) + 1) <= successRate) {
                            let atkEqList = Array.isArray(attacker.equips) ? attacker.equips : (attacker.equip ? [attacker.equip] : []);
                            let isResisted = atkEqList.some(eid => eid && ITEMS[eid] && ITEMS[eid].resist_status === bodyStatus);

                            if (attacker.trait === "magic_bounce") {
                                await wait(800); await showMsg(`${attacker.name} の マジックミラー！`);
                                if (def.status !== bodyStatus) {
                                    def.status = bodyStatus; def.statusTurn = 3;
                                    await wait(800); await showMsg(`跳ね返されて ${def.name} が 【${STATUS_NAMES[bodyStatus]}】に！`);
                                }
                            } else if (isResisted) {
                                await wait(800); await showMsg(`${attacker.name} は 装備で 【${STATUS_NAMES[bodyStatus]}】を 防いだ！`);
                            } else if (attacker.trait === "tough_body" && Math.random() < 0.5) {
                                await wait(800); await showMsg(`${attacker.name} は 【${bodyName}】の反撃を 耐え切った！`);
                            } else {
    attacker.status = bodyStatus; 
    attacker.statusTurn = 3;
    attacker.statusAppliedTurn = state.turnCount; // 🌟 追加
    await wait(800); 
    await showMsg(`【${bodyName}】 攻撃した ${attacker.name} は ${STATUS_NAMES[bodyStatus]} になってしまった！`);
    await updateUI();
}
                        }
                    }
                }
            } // ◀ 🌟 (ダメージ適用ブロックの終了)

            // 自分が死んだらこれ以上ループを進めない（ゾンビ化防止）
            if (attacker.hp <= 0) {
                break;
            }
            // ▼▼▼ 以下は、相手が生きている場合のみ処理される部分 ▼▼▼
            if (def.hp > 0) {
                // 弱点保険系（on_weak）
                if (isWeak) {
                    let eqList = Array.isArray(def.equips) ? def.equips : (def.equip ? [def.equip] : []);
                    let triggeredItemId = eqList.find(eid => eid && ITEMS[eid] && ITEMS[eid].auto_trigger === "on_weak");

                    if (triggeredItemId) {
                        consumeEquipItem(def, triggeredItemId);
                        initResistance(def, !isPlayerAttack);
                        await wait(800);
                        await showMsg(`【オート】弱点を受けた ${def.name} の ${ITEMS[triggeredItemId].name} が発動！\n全耐性が 即座に復旧した！`);
                        await updateUI();
                    }
                }

                // かんせん
                if (currentDefTrait === "infection" && def.status && def.status !== "none" && def.status !== "doom" && attacker.status !== def.status) {
                    attacker.status = def.status; attacker.statusTurn = 4;
                    await wait(800); await showMsg(`【かんせん】 ${def.name} の ${STATUS_NAMES[def.status]} が ${attacker.name} にうつった！`);
                }

                // すりかえ
                if (atkTrait === "switcheroo") {
                    if (def.isBoss === "true") {
                        await wait(800); await showMsg(`【すりかえ】 しかし ボスの装備は 奪えなかった！`);
                    } else {
                        let pChar = isPlayerAttack ? attacker : def;
                        let eChar = isPlayerAttack ? def : attacker;
                        let pEqList = Array.isArray(pChar.equips) ? [...pChar.equips] : (pChar.equip ? [pChar.equip] : []);
                        let eEqList = Array.isArray(eChar.equips) ? [...eChar.equips] : (eChar.equip ? [eChar.equip] : []);

                        // 味方が失う装備を在庫(ownedEquips)から削除
                        pEqList.forEach(eid => {
                            if (eid && eid !== "none") {
                                const idx = state.ownedEquips.indexOf(eid);
                                if (idx !== -1) state.ownedEquips.splice(idx, 1);
                            }
                        });

                        // 敵から奪った装備を在庫(ownedEquips)に追加
                        eEqList.forEach(eid => {
                            if (eid && eid !== "none") {
                                state.ownedEquips.push(eid);
                            }
                        });

                        // 装備配列自体を入れ替える
                        pChar.equips = eEqList;
                        eChar.equips = pEqList;

                        // 互換用の古いデータは消去
                        pChar.equip = null;
                        eChar.equip = null;

                        await wait(800); await showMsg(`【すりかえ】 攻撃のどさくさに お互いの装備をすべて交換した！`);
                    }
                }
            } // ◀ (def.hp > 0) の閉じカッコ

            if (def.hp <= 0 && atkTrait === "melody") {
                let healHp = Math.floor(attacker.maxHp * 0.2);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healHp);
                if (state.enableResistance) {
                    const aStats = getStats(attacker, isPlayerAttack);
                    attacker.curShock = Math.min(aStats.maxShock, attacker.curShock + Math.floor(aStats.maxShock * 0.2));
                    attacker.curHeat = Math.min(aStats.maxHeat, attacker.curHeat + Math.floor(aStats.maxHeat * 0.2));
                    attacker.curElec = Math.min(aStats.maxElec, attacker.curElec + Math.floor(aStats.maxElec * 0.2));
                }
                await showMsg(`【せんりつ】 ${attacker.name} は 敵を倒し 力が漲った！`); await wait(800);
            }

            // 状態異常付与
            let inflictStatuses =[];
            
            // 🌟 修正：状態異常システムがONの時だけ、付与する異常のリストを作成する
            if (state.enableStatus) {
                if (skill && skill.inflict_status && skill.inflict_status !== "none") {
                    inflictStatuses.push(skill.inflict_status);
                }

                let eqListAtk = Array.isArray(attacker.equips) ? attacker.equips : (attacker.equip ? [attacker.equip] :[]);
                eqListAtk.forEach(eid => {
                    if (eid && ITEMS[eid] && ITEMS[eid].inflict_status && ITEMS[eid].inflict_status !== "none") {
                        if (!inflictStatuses.includes(ITEMS[eid].inflict_status)) {
                            inflictStatuses.push(ITEMS[eid].inflict_status);
                        }
                    }
                });
            }
            
            for (let inflictStatus of inflictStatuses) {
                if (def.hp <= 0) break;

                if (def.status === inflictStatus) continue;
if (!isStatusOverwritable(def.status)) continue; 
                const relatedAttr = STATUS_ELEMENT_MAP[inflictStatus] || "none"; let successRate = 75;
                if (relatedAttr !== "none") {
                    const aff = getFinalAffinity(def, relatedAttr, atkTrait);
                    switch (aff) { case "wk": successRate = 100; break; case "hl": successRate = 50; break; case "rs": successRate = 25; break; case "nu": case "rp": case "ab": successRate = 0; break; }
                }
                 if (atkTrait === "status_master") successRate *= 2;
        if (currentDefTrait === "tough_body") successRate = Math.floor(successRate / 2);
        
        // 🌟 修正：「じゅばく(curse)」なら、相性や相手の耐性に関係なく無条件で100%にする
        if (atkTrait === "curse") successRate = 100;
        
        successRate = Math.min(100, successRate);

        if ((Math.floor(Math.random() * 100) + 1) <= successRate) {
            let eqList = Array.isArray(def.equips) ? def.equips : (def.equip ? [def.equip] : []);
            let isResisted = eqList.some(eid => eid && ITEMS[eid] && ITEMS[eid].resist_status === inflictStatus);
            
            // 🌟 修正：「じゅばく(curse)」なら、相手の装備や特性（マジックミラー等）による抵抗すらも強行突破する！
            if (atkTrait === "curse") {
                isResisted = false; 
                if (currentDefTrait === "magic_bounce") currentDefTrait = "none";
            }

                    if (currentDefTrait === "magic_bounce") {
                        await wait(800); await showMsg(`${def.name} の マジックミラー！`);
                        if (attacker.status !== inflictStatus) { attacker.status = inflictStatus; attacker.statusTurn = 4; await wait(800); await showMsg(`${attacker.name} は 【${STATUS_NAMES[inflictStatus]}】に！`); }
                    } else if (isResisted) {
                        await wait(800); await showMsg(`${def.name} は 装備で 【${STATUS_NAMES[inflictStatus]}】を 防いだ！`);
                    } else if (inflictStatus === "doom" && def.isBoss === "true") {
                        await wait(800); await showMsg(`しかし ${def.name} に 破滅は 効かない！`);
                    if (def.status !== "doom") {
    def.status = inflictStatus; 
    def.statusTurn = 4;
    def.statusAppliedTurn = state.turnCount; // 🌟 追加：付与されたターンを記録
    await wait(800); 
    await showMsg(`${def.name} は 【${STATUS_NAMES[inflictStatus]}】状態に！`);
}

                        if (currentDefTrait === "resonance" && state.enablePartyBattle) {
                            let allies = isPlayerAttack ? state.enemy : state.player.slice(0, state.battleMemberCount || 3);
                            allies.forEach(a => { if (a.hp > 0 && a.status !== "doom") { a.status = inflictStatus; a.statusTurn = 4; } });
                            await wait(800); await showMsg(`【きょうめい】 共鳴により 味方全員に ${STATUS_NAMES[inflictStatus]} が広がった！`);
                        }

                        let triggeredItemId = eqList.find(eid => eid && ITEMS[eid] && ITEMS[eid].auto_trigger === "on_status");
                        if (triggeredItemId) {
                            consumeEquipItem(def, triggeredItemId);
                            def.status = "none";
                            def.statusTurn = 0;
                            await wait(800);
                            await showMsg(`【オート】${def.name} の ${ITEMS[triggeredItemId].name} が発動！\n状態異常が 即座に治った！`);
                            await updateUI();
                        }
                    }
                    break;
                } else {
                    await wait(800); await showMsg(`${def.name} は 状態異常を こらえた！`);
                }
            }

            // ブレイク・耐性削り
            let resMsg = "";
            if (state.enableResistance && def.hp > 0 && def.status !== "protect") {
                let modShock = (skill && skill.mod_shock !== undefined) ? skill.mod_shock : 1.0;
                let modHeat = (skill && skill.mod_heat !== undefined) ? skill.mod_heat : 1.0;
                let modElec = (skill && skill.mod_elec !== undefined) ? skill.mod_elec : 1.0;

                let tShock = Math.floor(atkStats.atkShock * modShock) + (skill && skill.add_shock ? skill.add_shock : 0);
                let tHeat = Math.floor(atkStats.atkHeat * modHeat) + (skill && skill.add_heat ? skill.add_heat : 0);
                let tElec = Math.floor(atkStats.atkElec * modElec) + (skill && skill.add_elec ? skill.add_elec : 0);

                if (atkTrait === "destruction") { tShock *= 2; tHeat *= 2; tElec *= 2; }

                if (def.breakShock <= 0 && tShock > 0) { 
                    let rD = tShock; if (def.resUpShock) rD = Math.floor(rD / 2); def.curShock -= rD; 
                    if (def.curShock <= 0) { 
                        def.curShock = 0; 
                        let rev = def.revShock || 2; if (def.status === "stagnate") rev *= 2; 
                        def.breakShock = rev; 
                        def.breakShockTurn = state.turnCount; // 🌟 
                        resMsg += "衝 "; 
                    } 
                }
                // 熱量
                if (def.breakHeat <= 0 && tHeat > 0) { 
                    let rD = tHeat; if (def.resUpHeat) rD = Math.floor(rD / 2); def.curHeat -= rD; 
                    if (def.curHeat <= 0) { 
                        def.curHeat = 0; 
                        let rev = def.revHeat || 2; if (def.status === "stagnate") rev *= 2; 
                        def.breakHeat = rev; 
                        def.breakHeatTurn = state.turnCount; // 🌟 
                        resMsg += "熱 "; 
                    } 
                }
                // 電磁
                if (def.breakElec <= 0 && tElec > 0) { 
                    let rD = tElec; if (def.resUpElec) rD = Math.floor(rD / 2); def.curElec -= rD; 
                    if (def.curElec <= 0) { 
                        def.curElec = 0; 
                        let rev = def.revElec || 2; if (def.status === "stagnate") rev *= 2; 
                        def.breakElec = rev; 
                        def.breakElecTurn = state.turnCount; // 🌟 
                        resMsg += "電 "; 
                    } 
                }
            }
            await updateUI();
            if (resMsg) { await wait(800); await showMsg(`<span style="color:#e53e3e; font-weight:bold;">${resMsg}ブレイク!!</span>`); }

            if (resMsg && def.hp > 0) {
                let eqList = Array.isArray(def.equips) ? def.equips : (def.equip ? [def.equip] : []);
                let triggeredItemId = eqList.find(eid => {
                    if (!eid || !ITEMS[eid] || !ITEMS[eid].auto_trigger) return false;
                    const trig = ITEMS[eid].auto_trigger;
                    if (trig === "on_break") return true;
                    if (trig === "on_break_shock" && resMsg.includes("衝")) return true;
                    if (trig === "on_break_heat" && resMsg.includes("熱")) return true;
                    if (trig === "on_break_elec" && resMsg.includes("電")) return true;
                    return false;
                });

                if (triggeredItemId) {
                    const eq = ITEMS[triggeredItemId];
                    consumeEquipItem(def, triggeredItemId);
                    await wait(800);
                    await showMsg(`【オート】${def.name} の ${eq.name} が作動！`);

                    if (eq.auto_trigger === "on_break_shock") { def.curShock = getStats(def, !isPlayerAttack).maxShock; def.breakShock = 0; await showMsg(`衝撃耐性が 全快した！`); }
                    else if (eq.auto_trigger === "on_break_heat") { def.curHeat = getStats(def, !isPlayerAttack).maxHeat; def.breakHeat = 0; await showMsg(`熱量耐性が 全快した！`); }
                    else if (eq.auto_trigger === "on_break_elec") { def.curElec = getStats(def, !isPlayerAttack).maxElec; def.breakElec = 0; await showMsg(`電磁耐性が 全快した！`); }
                    else { initResistance(def, !isPlayerAttack); await showMsg(`全耐性が 即座に復旧した！`); }

                     if (state.enableStatus && eq.inflict_status && eq.inflict_status !== "none") {
                        // 🌟 変更後：上書きしても良いかどうかのガードを1行追加！
                        if (isStatusOverwritable(def.status)) {
                            def.status = eq.inflict_status; def.statusTurn = 3; def.statusAppliedTurn = state.turnCount;
                            await showMsg(`${def.name} は 代償として 【${STATUS_NAMES[eq.inflict_status]}】状態になった！`);
                        }
                    }
                    await updateUI();
                    await wait(800);
                }
            }

            if (!state.isPvP && def.hp > 0 && def.trigger_id) {
                let currentSkillId = skill ? skill.id : "normal";
                let aEqList = Array.isArray(attacker.equips) ? attacker.equips : (attacker.equip ? [attacker.equip] : []);

                if (def.trigger_id === currentSkillId || aEqList.includes(def.trigger_id)) {
                    if (def.trigger_scene && SCENARIO[def.trigger_scene]) {
                        gimmickJumpTo = def.trigger_scene;
                        gimmickTriggerName = def.name;
                    }
                }
            }
            await wait(800);
        }
        if (killedEnemyInThisAttack && isPlayerAttack && attacker.hp > 0) {
            await showCutin(attacker);
        }
        if (atkTrait === "vampire" && totalDmgDealt > 0) {
            let healAmount = Math.max(1, Math.floor(totalDmgDealt * 0.1)); attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            await wait(800); await showMsg(`${attacker.name} の きゅうけつき！\nHPを ${healAmount} 吸い取った！`);
        }

        if (skill && totalDmgDealt > 0) {
            let recoilMsg = "";
            let recoilMult = (attacker.status === "drown") ? 2 : 1;
            if (attacker.status === "immovable") recoilMult = 0; // 不動
            if (atkTrait === "recoil_saver") recoilMult *= 0.75;

            let hasMasterTrait = false;
            if (skill && skill.atk_element && skill.atk_element !== "none") {
                if (atkTrait === skill.atk_element + "_master") hasMasterTrait = true;
            } else {
                let eqList = Array.isArray(attacker.equips) ? attacker.equips : (attacker.equip ? [attacker.equip] : []);
                eqList.forEach(eid => {
                    if (eid && ITEMS[eid] && ITEMS[eid].atk_element && ITEMS[eid].atk_element !== "none") {
                        if (atkTrait === ITEMS[eid].atk_element + "_master") hasMasterTrait = true;
                    }
                });
            }
            if (hasMasterTrait) recoilMult *= 0.5;

            // HP反動
            if (skill.recoil_hp) {
                let rHp = Math.floor(skill.recoil_hp * recoilMult);
                attacker.hp = Math.max(0, attacker.hp - rHp);
                recoilMsg += `HP${rHp} `;
            }

            // 耐性反動
             if (attacker.status !== "protect") {
                if (skill.recoil_shock) {
                    let rS = Math.floor(skill.recoil_shock * recoilMult);
                    attacker.curShock = Math.max(0, attacker.curShock - rS);
                    recoilMsg += `衝${rS} `;
                    if (attacker.curShock <= 0 && attacker.breakShock <= 0) {
                        let rev = attacker.revShock || 2; if (attacker.status === "stagnate") rev *= 2;
                        attacker.breakShock = rev;
                        attacker.breakShockTurn = state.turnCount; // 🌟 
                        recoilMsg += `(BRK!) `;
                    }
                }
                // 熱量反動
                if (skill.recoil_heat) {
                    let rH = Math.floor(skill.recoil_heat * recoilMult);
                    attacker.curHeat = Math.max(0, attacker.curHeat - rH);
                    recoilMsg += `熱${rH} `;
                    if (attacker.curHeat <= 0 && attacker.breakHeat <= 0) {
                        let rev = attacker.revHeat || 2; if (attacker.status === "stagnate") rev *= 2;
                        attacker.breakHeat = rev;
                        attacker.breakHeatTurn = state.turnCount; // 🌟 
                        recoilMsg += `(BRK!) `;
                    }
                }
                // 電磁反動
                if (skill.recoil_elec) {
                    let rE = Math.floor(skill.recoil_elec * recoilMult);
                    attacker.curElec = Math.max(0, attacker.curElec - rE);
                    recoilMsg += `電${rE} `;
                    if (attacker.curElec <= 0 && attacker.breakElec <= 0) {
                        let rev = attacker.revElec || 2; if (attacker.status === "stagnate") rev *= 2;
                        attacker.breakElec = rev;
                        attacker.breakElecTurn = state.turnCount; // 🌟 
                        recoilMsg += `(BRK!) `;
                    }
                }
            }
            if (recoilMsg) { await wait(800); await showMsg(`反動で ${attacker.name} の ${recoilMsg} が減少！`); await updateUI(); }
        }
        await wait(800);
    } else {
        // 🌟 空振りの場合
        await showMsg("しかし 攻撃は 外れた！");
        attacker.hitCombo = 0;
        await wait(800);
    }
    if (atkTrait === "quick_hands" && roll >= 8 && !attacker.hasExtraTurn && attacker.hp > 0) {
        if (attacker.status !== "stone" && attacker.status !== "sleep") {
            let aliveTargets = targetList.filter(t => t.hp > 0);
            if (aliveTargets.length === 0) {
                let newTarget = getAliveTarget(!isPlayerAttack);
                if (newTarget) aliveTargets = [newTarget];
            }
            if (aliveTargets.length > 0) {
                attacker.hasExtraTurn = true;
                await showMsg(`【はやわざ】 ${attacker.name} の 素早い動き！ 追加行動！`); await wait(800);

                // 🌟 修正：追加行動の際も、元のテンションを維持したまま再帰呼び出しするために、
                // 一時的にテンションを元に戻しておく（この後で解除されるため）
                if (state.enableTension) attacker.tension = snapshotTension;

                await executeAttackSequence(attacker, aliveTargets, skill, false);
            }
        }
    }

    // アクションがすべて終わったら初ターン・追加行動フラグを解除
    attacker.hasExtraTurn = false;

    if (atkTrait === "double_strike" && !attacker.hasDoubleStrike && attacker.hp > 0 && !isCounter && !attacker.hasExtraTurn) {
        let aliveTargets = targetList.filter(t => t.hp > 0);
        if (aliveTargets.length === 0) {
            let newTarget = getAliveTarget(!isPlayerAttack);
            if (newTarget) aliveTargets = [newTarget];
        }

        if (aliveTargets.length > 0) {
            attacker.hasDoubleStrike = true;
            await showMsg(`【れんげき】 ${attacker.name} は 怒涛の連続攻撃！`); await wait(800);

            // 🌟 修正：連撃の際も、元のテンションを維持したまま再帰呼び出し
            if (state.enableTension) attacker.tension = snapshotTension;

            await executeAttackSequence(attacker, aliveTargets, skill, isCounter);
        } else {
            attacker.hasDoubleStrike = false;
        }
    } else {
        attacker.hasDoubleStrike = false;
    }
    if (state.enableTension && attacker.tension > 0 && !attacker.hasDoubleStrike && !attacker.hasExtraTurn) {
        // サポート技（回復やバフなど）ではテンションを消費しない
        if (!isSupport && (skill === null || skill.dmg_mod > 0)) {
            attacker.tension = 0;
            await showMsg(`${attacker.name} のテンションが元に戻った。`);
            await updateUI(); // 🌟 ここを追加！：画面のテンション表示を即座に消す
            await wait(800);
        }
    }

    if (skill && skill.special_effect === "recharge_1") {
        attacker.rechargeTurn = 1;
    }
    if (gimmickJumpTo && !state.isPvP) {
        await showMsg(`【イベント発生】 ${gimmickTriggerName} に 何かが起きた！`);
        await wait(800);
        state.isAnimating = false;

        // 🌟 ここを追加：イベントに飛ぶ前に全員の表情を消す
        attacker.tempEmotion = null;
        targetList.forEach(t => { if (t) t.tempEmotion = null; });
        state.player.forEach(p => { if (p) p.tempEmotion = null; });
        state.enemy.forEach(e => { if (e) e.tempEmotion = null; });

        saveGame();
        jumpTo(gimmickJumpTo);
        return;
    }

    // 🌟 修正：攻撃に関わった全員の「一時的な顔(攻撃・ダメージ等)」を完全に消す
    attacker.tempEmotion = null;
    attacker.hasBeenCountered = false;
    targetList.forEach(t => { if (t) t.tempEmotion = null; });

    state.player.forEach(p => { if (p) p.tempEmotion = null; });
    state.enemy.forEach(e => { if (e) e.tempEmotion = null; });

    // 🌟 修正：ここから下を、以下の3行だけに書き換えてください
    if (document.getElementById("view-battle").classList.contains("active")) {
        await updateUI(); // これだけで1vs1もパーティ戦も安全に最新の顔になります
    }
}

// ==========================================
// メッセージ表示（タイプライター）機能【完全版】
// ==========================================
// ==========================================
// メッセージ表示（タイプライター）機能
// ==========================================
let msgTypewriterInterval = null;
let isMsgTyping = false;
let currentSkipHandler = null;
let currentMsgResolve = null;

window.showMsg = async function (m) {
    // 🌟 修正：現在表示されている画面を判定して、正しい宛先を確実に選ぶ！
    let textEl;
    if (document.getElementById("view-battle").classList.contains("active")) {
        textEl = document.getElementById("msg-window");
    } else {
        textEl = document.getElementById("story-text");
    }
    if (!textEl) return;

    // ログ用のテキスト（タグ除去）
    const cleanText = m.replace(/<[^>]*>?/gm, '').trim();
    if (cleanText) {
        messageLog.push({ speaker: "システム", text: cleanText, type: "system" });
        while (messageLog.length > 100) messageLog.shift();
    }

    isSkipping = false;

    if (currentMsgResolve) {
        currentMsgResolve();
    }

    let speedMod = (typeof state !== "undefined" && state.msgSpeed !== undefined) ? state.msgSpeed : 1.0;
    let charDelay = 30 * speedMod;

    // 超速い設定なら一括表示して即終了
    if (speedMod <= 0.2) {
        if (textEl.id === "story-text") textEl.innerText = m;
        else textEl.innerHTML = m;
        return;
    }

    isMsgTyping = true;
    if (textEl.id === "story-text") textEl.innerText = "";
    else textEl.innerHTML = "";

    // HTMLタグを分解（タグによる表示崩壊を防ぐ）
    const tokens = [];
    let temp = "";
    let inTag = false;
    for (let i = 0; i < m.length; i++) {
        if (m[i] === '<') { inTag = true; temp = "<"; }
        else if (m[i] === '>') { inTag = false; temp += ">"; tokens.push({ type: 'tag', val: temp }); temp = ""; }
        else {
            if (inTag) temp += m[i];
            else tokens.push({ type: 'text', val: m[i] });
        }
    }

    return new Promise(resolve => {
        let i = 0;
        const registerTime = Date.now();

        // 🌟 確実なクリーンアップ関数（タイマーとイベントを消し、Promiseを解決する）
        currentMsgResolve = () => {
            if (msgTypewriterInterval) {
                clearInterval(msgTypewriterInterval);
                msgTypewriterInterval = null;
            }
            isMsgTyping = false;

            if (textEl.id === "story-text") textEl.innerText = m;
            else textEl.innerHTML = m;

            if (currentSkipHandler) {
                document.removeEventListener('click', currentSkipHandler);
                currentSkipHandler = null;
            }

            currentMsgResolve = null;
            resolve();
        };

        // クリックで一気に表示（スキップ）させる処理
        currentSkipHandler = (e) => {
            if (e && e.target.tagName.toLowerCase() === 'button') return;
            if (Date.now() - registerTime < 50) return; // バブリング対策

            if (isMsgTyping) currentMsgResolve();
        };
        document.addEventListener('click', currentSkipHandler);

        msgTypewriterInterval = setInterval(() => {
            // スキップフラグが立ったら全表示して終了
            if (isSkipping) {
                currentMsgResolve();
                return;
            }

            while (i < tokens.length && tokens[i].type === 'tag') {
                if (textEl.id === "story-text") textEl.innerText += tokens[i].val;
                else textEl.innerHTML += tokens[i].val;
                i++;
            }

            if (i < tokens.length) {
                if (textEl.id === "story-text") textEl.innerText += tokens[i].val;
                else textEl.innerHTML += tokens[i].val;
                i++;
            }

            if (i >= tokens.length) {
                currentMsgResolve();
            }
        }, charDelay);
    });
};


// ▼ sysLog 関数の上書き
function sysLog(m) {
    const l = document.getElementById("sys-log");
    if (l) {
        l.innerHTML += `<div>${m}</div>`;
        // 🌟 修正：DOMノード（HTML要素）が増えすぎないように50件で切り捨てる
        while (l.childElementCount > 50) {
            l.removeChild(l.firstChild);
        }
        l.scrollTop = l.scrollHeight;
    }
}
function flash() { const f = document.getElementById("flash-overlay"); if (f) { f.style.opacity = 0.5; setTimeout(() => f.style.opacity = 0, 100); } }
// ==========================================
// アニメーション＆ウェイトスキップ機能
// ==========================================
window.toggleMsgSpeed = function () {
    // 1.0(普通) → 0.5(速い) → 0.2(超速い) → 1.0 のループ
    if (state.msgSpeed === undefined) state.msgSpeed = 1.0;

    if (state.msgSpeed === 1.0) {
        state.msgSpeed = 0.5;
        document.getElementById("btn-msg-speed").innerText = "🚀 メッセージ速度: 速い";
    } else if (state.msgSpeed === 0.5) {
        state.msgSpeed = 0.2;
        document.getElementById("btn-msg-speed").innerText = "⚡ メッセージ速度: 超速い";
    } else {
        state.msgSpeed = 1.0;
        document.getElementById("btn-msg-speed").innerText = "⏩ メッセージ速度: 普通";
    }

    showToast("メッセージ・演出の速度を変更しました", "info");
    saveGame(); // 設定を保存
};
let isSkipping = false;
let activeWaits = [];

const wait = (ms) => new Promise(resolve => {
    // 既にスキップ中（クリック連打等）なら待たずに即完了
    if (isSkipping) return resolve();

    // デフォルトは 1.0 (等倍)。設定で 0.5 (2倍速) や 0.2 (5倍速超サクサク) にできる
    let speedMod = (typeof state !== "undefined" && state.msgSpeed !== undefined) ? state.msgSpeed : 1.0;
    let finalMs = ms * speedMod;

    let timeoutId = setTimeout(() => {
        // 完了したタイマーをリストから消す
        activeWaits = activeWaits.filter(t => t.id !== timeoutId);
        resolve();
    }, finalMs);

    // スキップできるようにリストに登録
    activeWaits.push({ id: timeoutId, resolve: resolve });
});
// ==========================================
// アニメーション＆ウェイトスキップ機能
// ==========================================
window.skipAnimations = function () {
    if (state.isPvP) return;

    // スキップフラグを立てる
    isSkipping = true;

    // 待機中（wait）のタイマーを強制解除して次に進める
    activeWaits.forEach(t => {
        clearTimeout(t.id);
        t.resolve();
    });
    activeWaits = [];

    // 🌟 追加：文字送り中なら、即座に完了関数を呼んで全表示させる
    if (isMsgTyping && currentMsgResolve) {
        currentMsgResolve();
    }
};
document.querySelector('.app-container').addEventListener('click', (e) => {
    // 🌟 修正：.closest('button') を使うことで、ボタン内のアイコンや文字(div)をクリックしても確実にガードする！
    if (e.target.closest('button')) return;

    // 🌟 アニメーション中（操作不可の時）だけスキップを許可する
    if (document.getElementById('view-battle').classList.contains('active') && state.isAnimating) {
        skipAnimations();
    }
});


// ==========================================
// 🎮 統合キーボード操作（イベント管理センター）
// ==========================================
document.addEventListener('keydown', (e) => {

    // 【優先度1：モーダル（ポップアップ画面）が開いている場合】
    // 最も手前にある画面の操作だけを処理し、背後の操作を完全にブロックする
    const logModal = document.getElementById('log-modal');
    if (logModal && logModal.style.display === 'flex') {
        if (e.key === 'Escape') closeLogModal();
        return; // これ以上下の処理（テスト中断など）は行わない
    }

    const flagModal = document.getElementById('flag-status-modal');
    if (flagModal && flagModal.style.display === 'flex') {
        if (e.key === 'Escape') closeFlagStatusModal();
        return;
    }
    const sysModal = document.getElementById('system-menu-modal');
    if (sysModal && sysModal.style.display === 'flex') {
        if (e.key === 'Escape') closeSystemMenu();
        // ▼ 修正：メニューが開いている間は、決定キーや矢印キーなど全て無視する
        e.preventDefault();
        return;
    }

    // 【優先度2：テストプレイ中の強制中断】
    if (e.key === 'Escape' && state.isTestPlay) {
        exitTestPlay();
        return;
    }

    // 【優先度3：各ビュー（画面）ごとの専用操作】

    // ▼ マップ画面（WASD / 矢印キー移動）
    if (document.getElementById("view-map").classList.contains("active")) {
        if (['ArrowUp', 'w', 'W'].includes(e.key)) moveMap(0, -1);
        if (['ArrowDown', 's', 'S'].includes(e.key)) moveMap(0, 1);
        if (['ArrowLeft', 'a', 'A'].includes(e.key)) moveMap(-1, 0);
        if (['ArrowRight', 'd', 'D'].includes(e.key)) moveMap(1, 0);
        if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); actionMap(); }
        return;
    }

    // ▼ ストーリー画面（メッセージ送り）
    if (document.getElementById("view-story").classList.contains("active") && !state.isWaitingChoice) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextStory(); return; }
    }

    // ▼ アクションミニゲーム画面（釣り・採掘）
    if (document.getElementById("view-action-game").classList.contains("active")) {
        // 🌟 追加：テトリスのキーボード操作
        if (agState.step && agState.step.gameType === "tetris") {
            if (['ArrowLeft', 'a', 'A'].includes(e.key)) { e.preventDefault(); moveTetris(-1); return; }
            if (['ArrowRight', 'd', 'D'].includes(e.key)) { e.preventDefault(); moveTetris(1); return; }
            if (['ArrowDown', 's', 'S'].includes(e.key)) { e.preventDefault(); dropTetris(); return; }
        }

        // それ以外のアクション（ゲージ・QTE・連打）の操作
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); executeActionGame(); return; }
        if (e.key === 'Escape') { e.preventDefault(); leaveActionGame(); return; }
    }

    // ▼ バトル画面（コマンド選択）
    if (document.getElementById("view-battle").classList.contains("active") && !state.isAnimating) {
        const activeAreaId = document.getElementById("cmd-sub").style.display === "flex" ? "cmd-sub" : "cmd-main";
        const buttons = Array.from(document.querySelectorAll(`#${activeAreaId} button`)).filter(b => !b.disabled);
        if (buttons.length === 0) return;

        const currentIndex = buttons.indexOf(document.activeElement);

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            buttons[(currentIndex + 1) % buttons.length].focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            buttons[currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1].focus();
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
            if (activeAreaId === "cmd-sub") { e.preventDefault(); closeSub(); }
        }
        return;
    }

});
window.addEventListener('DOMContentLoaded', async () => {
    await document.fonts.ready; await checkSaveData(); changeView("view-title");
    setTimeout(() => {
        const btnOnline = document.querySelector("button[onclick='openOnlineMenu()']");
        if (btnOnline) {
            if (!navigator.onLine || typeof Peer === 'undefined') {
                btnOnline.style.opacity = "0.5";
                btnOnline.innerText = "🌐 オンライン(オフライン中)";
            }
        }
    }, 1500); // CDNの読み込み猶予を考慮して1.5秒後に判定
    const dropArea = document.getElementById('import-textarea'); if (dropArea) { dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); }); dropArea.addEventListener('dragleave', (e) => { e.preventDefault(); dropArea.classList.remove('drag-over'); }); dropArea.addEventListener('drop', (e) => { e.preventDefault(); dropArea.classList.remove('drag-over'); const files = e.dataTransfer.files; if (files.length > 0) { const file = files[0]; const name = file.name.toLowerCase(); if (file.type === "application/json" || name.endsWith(".json") || name.endsWith(".txt")) { const reader = new FileReader(); reader.onload = (event) => { dropArea.value = event.target.result; }; reader.readAsText(file); } else { alert("JSONファイルをドロップして！"); } } }); }
});

window.exitTestPlay = function () {
    if (!confirm("テストプレイを中断してエディタに戻りますか？\n(進行状況は保存されません)")) return;

    // 🌟 修正：共通関数を呼ぶだけ！
    cleanupGameState();

    document.getElementById("btn-exit-test").style.display = "none";
    changeView("view-editor");
};

window.selectActor = async function (idx) {
    if (!state.partyBattle || state.partyBattle.phase !== 'command') return;
    if (state.player[idx].hp <= 0) return;

    state.partyBattle.currentActorIdx = idx;
    state.activeP = idx; // 🌟 ここが重要：activePを確実に同期させる

    // 他のサブメニューが開いていたら閉じる
    document.getElementById("cmd-sub").style.display = "none";
    document.getElementById("cmd-main").style.display = "";
    updateUI();
    await showMsg(`＞＞ ${state.player[idx].name} の 行動を選択してください ＜＜`);
};

window.nextPartyCommand = function () {
    document.getElementById("cmd-main").style.display = "";

    // 初回のみのセットアップ
    if (state.partyBattle.currentActorIdx === -1) {
        if (state.isPvP) startPvPTimer();
        else startTurnTimer();

        // 🌟 修正：actions配列を生存・参加メンバーの数だけ null で初期化する（座席の用意）
        const maxMembers = state.battleMemberCount || 3;
        state.partyBattle.actions = new Array(Math.min(maxMembers, state.player.length)).fill(null);
    }

    // まだ行動が決まっていない「生きている最初のキャラ」を探す
    let nextIdx = -1;
    for (let i = 0; i < state.partyBattle.actions.length; i++) {
        if (state.player[i].hp > 0 && state.partyBattle.actions[i] === null) {
            nextIdx = i;
            break;
        }
    }

    if (nextIdx !== -1) {
        selectActor(nextIdx); // 自動でそのキャラを選択状態にする
    }
};



// ② ターゲットを選んだらキューに追加して次へ
window.executePartyCommand = function (targetIdx) {
    closeSub();

    let actorIdx = state.partyBattle.currentActorIdx;

    // 🌟 修正：push ではなく、そのキャラ専用の「座席(インデックス)」に上書き保存する
    state.partyBattle.actions[actorIdx] = {
        isPlayer: true,
        actorIdx: actorIdx,
        action: state.partyBattle.tempAction,
        param: state.partyBattle.tempParam,
        targetIdx: targetIdx
    };

    // 生きているメンバー全員の行動が決まったかチェックする
    let allReady = true;
    for (let i = 0; i < state.partyBattle.actions.length; i++) {
        if (state.player[i].hp > 0 && state.partyBattle.actions[i] === null) {
            allReady = false;
            break;
        }
    }

    if (allReady) {
        // 🌟 修正：null（死者の枠）を排除して、実行用の配列に整える
        state.partyBattle.actions = state.partyBattle.actions.filter(a => a !== null);

        if (state.isPvP) {
            onPvPCommandsReady();
        } else {
            startPartyTurn(); // 全員決まったのでダイス判定へGO！
        }
    } else {
        // まだ決まっていない人がいるなら、次を促す
        nextPartyCommand();
    }
};

// ③ ターン開始・行動順の決定と実行ループ
async function startPartyTurn() {
    stopTurnTimer();
    isSkipping = false;

    state.partyBattle.phase = 'execute';
    closeSub();
    document.getElementById("cmd-main").style.display = "none";

    if (!state.isPvP) {
        state.enemy.forEach((e, i) => {
            if (e.hp > 0) {
                // 挑発状態なら通常攻撃、そうでなければAIで技を決定
                let sid = getEnemyAction(e);
                const eskill = (sid === 'normal' || sid === 'nothing' || sid === 'tension_up') ? null : SKILLS[sid];

                let finalTarget = -1;
                let actionType = "attack";

                if (sid === 'tension_up') {
                    actionType = "tension_up";
                    sid = "none";
                    finalTarget = -1;
                } else if (sid === 'nothing') {
                    finalTarget = -1;
                } else {
                    const tType = eskill ? (eskill.target_type || 'enemy_single') : 'enemy_single';

                    if (tType === 'enemy_all') finalTarget = 'enemy_all';
                    else if (tType === 'ally_all') finalTarget = 'ally_all';
                    else if (tType === 'self') finalTarget = 'self';
                    else if (tType === 'ally_single') {
                        let lowestHpEnemyIdx = -1;
                        let minHp = 99999;
                        state.enemy.forEach((en, idx) => {
                            if (en.hp > 0 && en.hp < minHp) {
                                minHp = en.hp;
                                lowestHpEnemyIdx = idx;
                            }
                        });
                        finalTarget = lowestHpEnemyIdx !== -1 ? lowestHpEnemyIdx : i;
                    } else {
                        let alivePlayers = state.player.map((p, idx) => ({ p, idx })).filter(x => x.idx < 3 && x.p.hp > 0);
                        if (alivePlayers.length > 0) {
                            finalTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].idx;
                        }
                    }
                }

                // 🌟 最重要修正：プレイヤーの予約席（0, 1, 2番）を上書きしないよう、pushで末尾に追加する！
                state.partyBattle.actions.push({
                    isPlayer: false,
                    actorIdx: i,
                    action: actionType,
                    param: sid,
                    targetIdx: finalTarget
                });
            }
        });
    }

    // プレイヤーの死体予約（null）などを排除して、きれいなリストにする
    state.partyBattle.actions = state.partyBattle.actions.filter(a => a !== null);

    await executePartyTurn();
}

// アクション実行のメインループ
async function executePartyTurn() {
    state.isAnimating = true;
    closeSub();
    document.getElementById("cmd-main").style.display = "none";
[...state.player, ...state.enemy].forEach(c => {
        if (c) c.turnDice = undefined;
    });
    for (let act of state.partyBattle.actions) {
        let char = act.isPlayer ? state.player[act.actorIdx] : state.enemy[act.actorIdx];
        act.stats = getStats(char, act.isPlayer, "none");
        let dice = Math.floor(Math.random() * act.stats.maxDice) + 1;

        if ((char.trait || "none") === "lucky") dice = Math.max(dice, Math.max(1, Math.floor(act.stats.maxDice * 0.2)));
        if (char.status === "stone") dice = 0;
        if (char.status === "reverse") dice = (act.stats.maxDice + 1) - dice;

        act.initDice = dice;

        // 🌟 修正：ここで各キャラに「自分の振ったダイスの目」をしっかり刻み込む！
        char.turnDice = dice;

        act.priority = 0;
        if (char.status === "fast") act.priority = 1;
        if (char.status === "slow") act.priority = -1;
        if (char.trait === "preemptive" && char.isFirstTurn) act.priority = 10;
        if (char.status === "reverse") act.priority *= -1;

        // 🌟 修正：ここで powerEl を探して色を変えていた処理を丸ごと削除しました！
    }

    // ソート（行動順の決定）
    state.partyBattle.actions.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.initDice - a.initDice;
    });

    // 🌟 修正：ソートが終わった直後にUIを1回だけ更新し、ダイスと順位バッジを一斉表示する！
    await updateUI();
isSkipping = false;
    const loopStartSceneId = state.currentSceneId;

    // --- アクションの実行ループ ---
    for (let i = 0; i < state.partyBattle.actions.length; i++) {
        if (state.currentSceneId !== loopStartSceneId) return;
        isSkipping = false;

        let act = state.partyBattle.actions[i];
        let actor = act.isPlayer ? state.player[act.actorIdx] : state.enemy[act.actorIdx];

        if (actor.hp <= 0) continue;

        if (act.action === "change") {
            let reserveIdx = act.param;
            let targetP = state.player[act.actorIdx];
            let newP = state.player[reserveIdx];
            await showMsg(`作戦変更！ ${targetP.name} に代わって ${newP.name} が場に出る！`);
            let temp = state.player[act.actorIdx];
            state.player[act.actorIdx] = state.player[reserveIdx];
            state.player[reserveIdx] = temp;
            newP.isFirstTurn = true;
            await updateUI();
            continue;
        }

        if (act.action === "equip") {
            let itemId = act.param;
            if (!actor.equips) actor.equips = [actor.equip];
            let oldEquip = actor.equips[0];
            if (act.isPlayer && oldEquip && oldEquip !== "none") state.ownedEquips.push(oldEquip);
            if (itemId === "none") {
                await showMsg(`${actor.name} は 装備を外した！`);
                actor.equips[0] = null;
            } else {
                await showMsg(`${actor.name} は ${ITEMS[itemId].name} を構えた！`);
                if (act.isPlayer) {
                    let idx = state.ownedEquips.indexOf(itemId);
                    if (idx !== -1) state.ownedEquips.splice(idx, 1);
                }
                actor.equips[0] = itemId;
            }
            await updateUI();
            continue;
        }

if (act.action === 'attack' && act.param === 'normal' && actor.trait === "spread_attack") act.targetIdx = 'enemy_all';
        
        let targetList = [];
        let mainTarget = null; // 🌟 宣言だけしておく
        const skill = act.action === 'attack' ? (act.param === 'normal' || act.param === 'nothing' ? null : SKILLS[act.param]) : null;

        // --- ターゲット変換処理 ---
        if (act.targetIdx === 'enemy_all') targetList = act.isPlayer ? state.enemy.filter(e => e.hp > 0) : state.player.filter((p, i) => i < 3 && p.hp > 0);
        else if (act.targetIdx === 'ally_all') targetList = act.isPlayer ? state.player.filter((p, i) => i < 3 && p.hp > 0) : state.enemy.filter(e => e.hp > 0);
        else if (act.targetIdx === 'self') { mainTarget = actor; targetList = [actor]; }
        else if (act.targetIdx === 'field_all') {
            let pAlive = state.player.filter((p, i) => i < 3 && p.hp > 0);
            let eAlive = state.enemy.filter(e => e.hp > 0);
            targetList = [...pAlive, ...eAlive];
        } else if (act.targetIdx !== -1 && act.targetIdx !== undefined) {
            // 🌟 修正：ally_all などのターゲットタイプも含めて味方対象技かを判定
            let isAllyTarget = (act.action === "item" && ["heal", "cure_status", "buff", "rec_res", "res_up", "guarantee_hit", "transform_crit", "guarantee_dodge", "counter"].includes(ITEMS[act.param]?.effect)) || (skill && ["ally_single", "ally_all", "self", "field_all"].includes(skill.target_type));
            
            // 🌟 一時変数 t をやめて、mainTarget に代入する
            mainTarget = act.isPlayer ? (isAllyTarget ? state.player[act.targetIdx] : state.enemy[act.targetIdx]) : (isAllyTarget ? state.enemy[act.targetIdx] : state.player[act.targetIdx]);
            
            if (mainTarget && mainTarget.hp <= 0 && act.action === "attack") {
                let aliveTargets = act.isPlayer ? state.enemy.filter(e => e.hp > 0) : state.player.filter((p, i) => i < 3 && p.hp > 0);
                if (aliveTargets.length > 0) mainTarget = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
            }
            if (mainTarget && act.action === "attack" && !isAllyTarget) {
                let defTeam = act.isPlayer ? state.enemy : state.player.slice(0, state.battleMemberCount || 3);
                if (mainTarget.trait === "stealth") {
                    let otherAlive = defTeam.filter(char => char.hp > 0 && char.trait !== "stealth");
                    if (otherAlive.length > 0) mainTarget = otherAlive[Math.floor(Math.random() * otherAlive.length)];
                }
                let provoker = defTeam.find(char => char.hp > 0 && char.trait === "provoke_aura");
                if (provoker) mainTarget = provoker;
            }
            if (mainTarget) targetList = [mainTarget];
        }

        let needsTarget = true;
        if (act.action === "escape" || act.action === "tension_up" || (act.action === "attack" && act.param === "nothing")) needsTarget = false;
        
        if (needsTarget && (targetList.length === 0 || !targetList[0] || typeof targetList[0].hp === 'undefined')) {
            // 🌟 ターゲットが既に死んでいる（全滅した）場合、無言でスキップせずにメッセージを出してバトンを繋ぐ
            await showMsg(`${actor.name} は 攻撃しようとしたが 標的がいなかった！`);
            continue; 
        }
        
        // 🌟 修正：重複していた古いコードを削除し、安全な indexOf を採用
        if (act.isPlayer) { 
            state.activeP = act.actorIdx; 
            let targetIdx = state.enemy.indexOf(mainTarget);
            state.activeE = targetIdx !== -1 ? targetIdx : 0; 
        } else { 
            state.activeE = act.actorIdx; 
            let targetIdx = state.player.indexOf(mainTarget);
            state.activeP = targetIdx !== -1 ? targetIdx : 0; 
        }
        
        let isSupportAction = (act.action === "item" && ["heal", "cure_status", "buff", "rec_res", "res_up", "guarantee_hit", "transform_crit", "guarantee_dodge", "counter"].includes(ITEMS[act.param]?.effect)) || (skill && ["ally_single", "ally_all", "self"].includes(skill.target_type));
        
        state.partyBattle.focusAttackerId = actor.id;
        state.partyBattle.focusTargetIds = targetList.filter(t => t).map(t => t.id);
        state.partyBattle.isSupportFocus = isSupportAction;
        
        // 🌟 ここで UI を更新し、今動いている人にハイライトを当てる！
        state.partyBattle.currentActorIdx = act.isPlayer ? act.actorIdx : -1;
        await updateUI();

        // 状態チェック
        if (actor.status === "stone" || actor.status === "sleep") {
            await showMsg(`${actor.name} は 【${STATUS_NAMES[actor.status]}】で 動けない！`); continue; 
        }
        if (actor.rechargeTurn > 0) {
            await showMsg(`${actor.name} は 技の反動で動けない！`); actor.rechargeTurn--; continue; 
        }
        if (act.action === "attack" && act.param === "tension_up") {
            await executeTensionUp(actor); continue;
        }

        // 実行フェーズへの遷移
        if (act.action === "attack") {
            let paramSkillId = act.param === 'normal' ? 'normal' : act.param;
            if (actor.status === "provoke" && paramSkillId !== "normal" && paramSkillId !== "nothing") { await showMsg(`${actor.name} は 挑発されていて 技が出せない！`); continue; }
            if (actor.status === "exception" && actor.lastUsedSkill === paramSkillId) { await showMsg(`【例外】状態のため、${actor.name} の技は失敗！`); continue; }
            if (actor.status === "repetition" && actor.lastUsedSkill && actor.lastUsedSkill !== paramSkillId) { await showMsg(`【反復】状態ため、${actor.name} は別の行動がとれない！`); continue; }

            if (skill) {
                let isBlocked = (skill.recoil_shock && actor.breakShock > 0) || (skill.recoil_heat && actor.breakHeat > 0) || (skill.recoil_elec && actor.breakElec > 0);
                if (isBlocked) { await showMsg(`オーバーヒート！\n${actor.name} は 復旧中のため 技が出せなかった！`); continue; }
            }

            if (act.param === "sys_event_jump") {
                await showMsg(`【イベント発生】 ${actor.name} に 何かが起きた！`);
                if (actor.trigger_scene && SCENARIO[actor.trigger_scene]) { state.isAnimating = false; saveGame(); jumpTo(actor.trigger_scene); return; }
            } else if (act.param === "nothing") {
               await showMsg(`${actor.name} は 様子を見ている……`); 
            } else {
                await executeAttackSequence(actor, targetList, skill, false);
                if (state.currentSceneId !== loopStartSceneId) return;
            }
        }
        else if (act.action === "tension_up") {
            await executeTensionUp(actor);
        } else if (act.action === "item") {
            if (actor.status === "seal") { await showMsg(`${actor.name} は 封印されていて どうぐが 使えない！`); continue; }
            
            if (act.isPlayer) {
                if ((state.inventory[act.param] || 0) <= 0) {
                    await showMsg(`${actor.name} は どうぐを使おうとしたが もう無かった！`);  continue;
                }
                state.inventory[act.param]--;
                if (state.inventory[act.param] <= 0) {
                    delete state.inventory[act.param];
                }
            }

            const item = ITEMS[act.param];
            if (!mainTarget) mainTarget = targetList[0];

            await showMsg(`${actor.name} は ${mainTarget.name} に ${item.name} を 使った！`); 
            await wait(800); // 🌟 追加：このウェイトが抜けていました
            
            if (!state.isPvP && mainTarget.hp > 0 && mainTarget.trigger_id && mainTarget.trigger_id === act.param) {
                if (mainTarget.trigger_scene && SCENARIO[mainTarget.trigger_scene]) {
                    await showMsg(`【イベント発生】 ${mainTarget.name} に 何かが起きた！`); await wait(800);
                    state.isAnimating = false; saveGame(); jumpTo(mainTarget.trigger_scene); return;
                }
            }

            // 🌟 修正：すべての効果メッセージの後に `await wait(800);` を追加
            if (item.effect === "heal") {
                let h = item.effectPower || 50;
                let wasDead = (mainTarget.hp <= 0);
                mainTarget.hp = Math.min(mainTarget.maxHp, mainTarget.hp + h);
                if (wasDead) {
                    mainTarget.status = "none"; mainTarget.statusTurn = 0; initResistance(mainTarget, act.isPlayer);
                    mainTarget.chargeSkillId = null; mainTarget.rechargeTurn = 0;
                    resolveTacticalOverlap(mainTarget);
                }
                await showMsg(`${mainTarget.name} の HPが回復した！`); await wait(800); // ◀ 追加
            }
            else if (item.effect === "heal_mp") {
                let h = item.effectPower || 50;
                let stats = getStats(mainTarget, act.isPlayer); 
                mainTarget.mp = Math.min(stats.maxMp || mainTarget.maxMp, mainTarget.mp + h);
                await showMsg(`${mainTarget.name} の MPが回復した！`); await wait(800); // ◀ 追加
            }
            else if (item.effect === "heal_st") {
                let h = item.effectPower || 50;
                let stats = getStats(mainTarget, act.isPlayer);
                mainTarget.st = Math.min(stats.maxSt || mainTarget.maxSt, mainTarget.st + h);
                await showMsg(`${mainTarget.name} の STが回復した！`); await wait(800); // ◀ 追加
            } else if (item.effect === "escape") {
                await showMsg(`煙玉！ にげだした！`); await wait(800); // ◀ 追加
                await processEscapeSuccess(actor, mainTarget);
                return;
            }
            else if (item.effect === "guarantee_hit") { mainTarget.guaranteeHit = true; await showMsg(`次攻撃が【必中】！`); await wait(800); }
            else if (item.effect === "transform_crit") { mainTarget.transformCrit = true; await showMsg(`次攻撃が【命中時クリティカル】！`); await wait(800); }
            else if (item.effect === "guarantee_dodge") { mainTarget.guaranteeDodge = true; await showMsg(`身代わり人形を 設置した！`); await wait(800); }
            else if (item.effect === "counter") { mainTarget.counterActive = true; await showMsg(`反撃の起爆符を 構えた！`); await wait(800); }
            else if (item.effect === "buff") {
                let amt = item.effectPower || 50;
                let allies = act.isPlayer ? state.player.slice(0, state.battleMemberCount || 3) : state.enemy;
                allies.forEach(pl => { if (pl.hp > 0) pl.statBuff = Math.min(200, (pl.statBuff || 0) + amt); });
                await showMsg(`味方全体のステータスが アップ！`); await wait(800); // ◀ 追加
            }
            else if (item.effect === "res_up") {
                if (item.id.includes("insulate") || item.id.includes("battery")) mainTarget.resUpElec = true;
                if (item.id.includes("oil") || item.id.includes("coolant")) mainTarget.resUpShock = true;
                if (item.id.includes("water") || item.id.includes("fireproof")) mainTarget.resUpHeat = true;
                await showMsg(`${mainTarget.name} の 耐性ゲージが 減りにくくなった！`); await wait(800); // ◀ 追加
            }
            else if (item.effect === "damage_fixed") { let d = item.effectPower || 50; mainTarget.hp = Math.max(0, mainTarget.hp - d); await showMsg(`${item.name} が炸裂！ ${mainTarget.name} に ${d} のダメージ！`); await wait(800); }
            else if (item.effect === "cure_status") { mainTarget.status = "none"; mainTarget.statusTurn = 0; await showMsg(`${mainTarget.name} の 状態異常が 完全に治った！`); await wait(800); }
            else if (item.effect === "rec_res") { initResistance(mainTarget, act.isPlayer); await showMsg(`${mainTarget.name} の全耐性が 復旧・全回復した！`); await wait(800); }

            if (state.enableStatus && item.inflict_status && item.inflict_status !== "none") {
                if (isStatusOverwritable(mainTarget.status)) {
                    mainTarget.status = item.inflict_status; 
                    mainTarget.statusTurn = 4;
                    mainTarget.statusAppliedTurn = state.turnCount; 
                    await showMsg(`${mainTarget.name} は 【${STATUS_NAMES[item.inflict_status]}】状態になった！`);
                    await wait(800); // 🌟 追加
                } else {
                    await showMsg(`${mainTarget.name} には 効かなかった！`);
                    await wait(800); // 🌟 追加
                }
            }

            await updateUI();
        } else if (act.action === "escape") {
            let actor = act.isPlayer ? state.player[act.actorIdx] : state.enemy[act.actorIdx];
            await showMsg(`${actor.name} は にげだそうとしている！`); await wait(500);

            if (act.isPlayer) {
                let maxEnemyDice = 1;
                state.enemy.forEach(en => {
                    if (en.hp > 0) {
                        let eDice = getStats(en, false).maxDice;
                        if (eDice > maxEnemyDice) maxEnemyDice = eDice;
                    }
                });
                let escapeRate = 50 + (getStats(actor, true).maxDice - maxEnemyDice);
                escapeRate = Math.max(10, Math.min(90, escapeRate));

                if ((Math.floor(Math.random() * 100) + 1) <= escapeRate) {
                    await showMsg(`うまく にげきれた！`); await wait(500);
                    await processEscapeSuccess(actor, state.enemy[0]);
                    return; 
                } else {
                   await showMsg(`しかし まわりこまれてしまった！`);
                }
            } else {
                await showMsg(`${actor.name} は 逃げ去ってしまった！`);
                actor.hp = 0; await updateUI();
            }

        } else if (act.action === "scout") {
            // 🌟 修正：mainTarget をそのまま使う
            if (!mainTarget) mainTarget = targetList[0];
            await showMsg(`${actor.name} は ${mainTarget.name} を スカウトしようとしている！`);

            const scoutedCount = state.battleFlags.scoutedList ? state.battleFlags.scoutedList.length : 0;
            if (state.player.length + scoutedCount >= state.maxPlayerCount) {
               await showMsg(`預かり所がいっぱいだお！<br>これ以上 仲間を増やせないお！`); await wait(800);
                continue; 
            }

            let rate = 10;
            rate += (1 - (mainTarget.hp / mainTarget.maxHp)) * 40;
            if (mainTarget.breakShock > 0 || mainTarget.breakHeat > 0 || mainTarget.breakElec > 0) rate += 25;
            if (mainTarget.status && mainTarget.status !== "none") rate += 25;

            let diceResult = await roll1d10Dice("スカウト", rate, "捕獲", "失敗", false);

            if (diceResult.isSuccess) {
                await showMsg(`やったお！ ${mainTarget.name} が 仲間になったお！`);

                mainTarget.dropMoney = 0; mainTarget.dropExp = 0;
                let newAlly = JSON.parse(JSON.stringify(mainTarget));
                let baseId = mainTarget.originalId || mainTarget.id.split('_')[0];
                newAlly.originalId = baseId;
                const uniqueHex = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0'); 
                newAlly.id = `${baseId}_${Date.now()}_${uniqueHex}`;

                newAlly.equip = null; newAlly.hp = newAlly.maxHp; newAlly.status = "none"; newAlly.statusTurn = 0;
                initResistance(newAlly, true);

                if (state.isPvP) { state.player.push(newAlly); await updateUI(); }
                else { state.battleFlags.scoutedList = state.battleFlags.scoutedList || []; state.battleFlags.scoutedList.push(newAlly); }
                mainTarget.hp = 0; state.battleScoutSuccess = true;

            } else {
                await showMsg(`ダメだお！ ${mainTarget.name} は こちらを警戒している！`); await wait(800);

                // 🌟 修正：パーティバトルでも、ダイスを振らずに「確定ヒット」の反撃をさせる
                if (mainTarget.hp > 0 && actor.hp > 0) {
                    let eSkillId = getEnemyAction(mainTarget);
                    if (eSkillId === "nothing") {
                        await showMsg(`${mainTarget.name} は 警戒しながら 様子を見ている……`); await wait(800);
                    } else {
                        let skill = (eSkillId === "normal") ? null : SKILLS[eSkillId];
                        
                        // 反撃なのでターゲットは「スカウトしてきた相手(actor)」に固定
                        mainTarget.guaranteeHit = true; 
                        
                        await showMsg(`＞＞ ${mainTarget.name} の 怒りの反撃！ ＜＜`); await wait(800);
                        
                        // isCounterフラグ(第4引数)を true にして、戦闘ダイスを省略する
                        if (mainTarget.hp > 0 && actor.hp > 0) {
                    await showMsg(`＞＞ ${mainTarget.name} の 怒りの反撃！ ＜＜`); await wait(800);
                    // 🌟 修正：executeAttackSequence はキューを破壊するため、直接ダメージ計算に流す
                    let eStats = getStats(mainTarget, false);
                    let aStats = getStats(actor, true);
                    // 単純な物理攻撃として処理（怒りなので2倍）
                    let dmg = Math.max(1, (eStats.dmg + Math.floor(eStats.tech/10)) - (aStats.def + Math.floor(aStats.exp/10)));
                    dmg *= 2; 
                    
                    await applyDamage(mainTarget, actor, dmg, false, false);
                    if (actor.hp <= 0) await showMsg(`${actor.name} は たおれた！`);
                }
                    }
                }
            }
        }

        if (state.isPvP && await checkPvPDead()) return;
        if (!state.isPvP && await checkPartyDead()) return;
        
        if (actor.hp > 0 && (actor.trait === "chain_ally" || actor.trait === "chain_enemy")) {
            let targetIsPlayer = (actor.trait === "chain_ally") ? act.isPlayer : !act.isPlayer;

            let remainingActions = state.partyBattle.actions.slice(i + 1);
            let chainTargets = [];
            let others = [];

            remainingActions.forEach(a => {
                if (a.isPlayer === targetIsPlayer) {
                    chainTargets.push(a);
                } else {
                    others.push(a);
                }
            });

            if (chainTargets.length > 0) {
                state.partyBattle.actions = [
                    ...state.partyBattle.actions.slice(0, i + 1),
                    ...chainTargets,
                    ...others
                ];

                let traitName = actor.trait === "chain_ally" ? "味方チェイン" : "敵チェイン";
                let targetName = actor.trait === "chain_ally" ? "味方" : "敵";
                await showMsg(`<span style="color:#805ad5; font-weight:bold;">【${traitName}】発動！<br>残るすべての ${targetName} を 強制的に引きずり出した！</span>`);
                playGlitchEffect();
                await updateUI();
            }
        }
    }

    // 🌟 修正：全員の行動が終わったら、状態を戻してUIを再描画する
    isSkipping = false; 
    state.partyBattle.focusAttackerId = null;
    state.partyBattle.focusTargetIds = null;
    state.partyBattle.isSupportFocus = false;
    state.partyBattle.phase = 'command';
    await updateUI();

    
    await processAllStatusTurnEnd();
    state.turnCount++;

    if (await checkTOD()) return;

    if (state.isPvP) {
        if (await checkPvPDead()) return;
        disablePvPRandom();
    } else {
        if (await checkPartyDead()) return;
    }

    [...state.player, ...state.enemy].forEach(c => { if (c) c.tempEmotion = null; });
    await updateUI();
    state.partyBattle.actions = new Array(Math.min(state.battleMemberCount || 3, state.player.length)).fill(null);
    state.partyBattle.currentActorIdx = -1;

    state.isAnimating = false;

    // 🌟 修正：UIを描画し終わってから（次のコマンド待ちになってから）記憶を消す！
    nextPartyCommand();
    
    state.player.forEach(p => p.turnDice = undefined);
    state.enemy.forEach(e => e.turnDice = undefined);
}
// ④ パーティ用全滅判定とリザルト
async function checkPartyDead() {

    // 🌟 追加：報酬の清算とレベルアップを安全に行うための内部関数
    const processRewards = async () => {
        let totalMoney = 0; let totalExp = 0;
        let droppedItems = []; // 🌟 追加：獲得アイテムのリスト

        state.enemy.forEach(e => { 
            if (e && e.hp <= 0) {
                totalMoney += (e.dropMoney || 0); 
                totalExp += (e.dropExp || 0); 
                
                // 🌟 追加：アイテムドロップ判定
                if (e.dropItem && e.dropRate > 0) {
                    let rate = e.dropRate || 0;
                    if ((Math.floor(Math.random() * 100) + 1) <= rate) {
                        const itemData = ITEMS[e.dropItem];
                        if (itemData) {
                            droppedItems.push(itemData); // リストに追加
                            
                            // 実際にインベントリに入れる処理
                            if (itemData.type === "consumable" || itemData.type === "skill_book") {
                                let current = state.inventory[e.dropItem] || 0;
                                let max = state.maxItemCount > 0 ? state.maxItemCount : 9999;
                                if (current < max) {
                                    state.inventory[e.dropItem] = current + 1;
                                }
                            } else {
                                state.ownedEquips.push(e.dropItem);
                            }
                        }
                    }
                }

                e.dropMoney = 0;
                e.dropExp = 0;
                e.dropRate = 0; // 二重ドロップ防止
            }
        });
        state.money = Math.min(99999999, state.money + totalMoney);
        
        if (state.enableLevelUp && totalExp > 0) {
            const travelPartyLimit = 8;
            for (let i = 0; i < travelPartyLimit && i < state.player.length; i++) {
                if (state.player[i].hp > 0) {
                    state.player[i].levelExp += totalExp;
                    if (i < (state.battleMemberCount || 3)) { state.activeP = i; await updateUI(); }
                    await checkLevelUp(state.player[i]);
                }
            }
        }
        saveGame(); // 最新ステータスを確定
        return { totalMoney, totalExp };
    };

    // ▼▼▼ 個別死亡イベントの割り込み判定 ▼▼▼
    for (let e of state.enemy) {
        if (e && e.hp <= 0 && e.death_scene && SCENARIO[e.death_scene]) {
            e.hp = 1;
            let jumpScene = e.death_scene;
            e.death_scene = ""; // 無限ループ防止のため消す
            isSkipping = false;
            await showMsg(`【イベント発生】 ${e.name} に 何かが起きた！`); await wait(500);
            
            // 🌟 修正：イベントで別のシーンに飛ぶ「前」に、倒した分の報酬を清算する！
            await processRewards();
            
            state.isAnimating = false; saveGame(); jumpTo(jumpScene); return true;
        }
    }
    for (let p of state.player.slice(0, state.battleMemberCount || 3)) {
        if (p && p.hp <= 0 && p.death_scene && SCENARIO[p.death_scene]) {
            p.hp = 1;
            let jumpScene = p.death_scene;
            p.death_scene = "";
            isSkipping = false;
            await showMsg(`【イベント発生】 ${p.name} に 致命傷！！\nしかし……！？`); await wait(500);
            state.isAnimating = false; saveGame(); jumpTo(jumpScene); return true;
        }
    }

    let pAlive = state.player.slice(0, state.battleMemberCount || 3).some(p => p && p.hp > 0);
    let eAlive = state.enemy.some(e => e && e.hp > 0);

    // 🌟 修正1：ここを追加！ タクティカル決闘中なら、リザルトに行かずに盤面へ帰る！
    if (state.tacData) {
        if (!pAlive || !eAlive) {
            state.isAnimating = false;
            // 盤面に復帰させる
            await returnToTacticalBoard(state.player[0], state.enemy[0]);
            return true; // 決闘はこれで終了
        }
        return false; // まだ決闘は続く
    }

    if (!pAlive && !eAlive) {
        await showMsg(`<span style="color:#805ad5; font-size:24px;">【相打ち】</span><br>おたがいに 力尽きたお……`);
        await wait(800);
        if (state.isPvP) { endPvP(); return true; }
        state.tacData = null; jumpTo(state.battleDrawNext || state.battleLoseNext); return true;
    }

    if (!eAlive) {
        await showMsg(`てきを ぜんめつさせた！`);
        await wait(800);

        if (state.isPvP) { endPvP(); return true; }

        // 🌟 修正：アイテムも受け取る
        let rewards = await processRewards();
        let msg = `${rewards.totalMoney} G を手に入れた！`;
        if (rewards.droppedItems.length > 0) {
            msg += `\nアイテム を落としていった！`;
        }
        await showMsg(msg); await wait(800);

        openResultScreen(rewards.totalMoney, rewards.totalExp, rewards.droppedItems);
        return true;
    }

    if (!pAlive) {
        await showMsg(`パーティは ぜんめつした……`);
        await wait(800);
        if (state.isPvP) { endPvP(); return true; }

        if (state.battleLoseNext) {
            state.player.forEach(char => { if (char.hp <= 0) char.hp = 1; });
            jumpTo(state.battleLoseNext);
        } else {
            await showMsg(`めのまえが まっくらになった……`);
            setTimeout(async () => { 
                if (state.isTestPlay) { 
                    alert("テスト終了"); state.isTestPlay = false; changeView("view-editor"); 
                } else { 
                    // 🌟 修正：タイトルへ戻る前に完全初期化を行う
                    cleanupGameState();
                    await checkSaveData(); 
                    changeView("view-title"); 
                } 
            }, 3000);
        }
        return true;
    }
    return false;
}
window.getAffinityIcons = function (char) {
    // 属性システムがオフなら空の箱を返して高さをキープ
    if (state.enableAttribute === false || state.enableAttribute === "false") {
        return '<div class="p-aff-box" style="min-height:16px; margin-top:2px;"></div>';
    }

    const isPlayer = state.player.includes(char);
    const canSee = isPlayer || (state.enableAnalyze !== false && state.enableAnalyze !== "false");

    if (!canSee) {
        return '<div class="p-aff-box" style="min-height:16px; margin-top:2px;"></div>';
    }

    const AFF_LABELS = { "wk": "弱", "hl": "半", "rs": "減", "nu": "無", "rp": "反", "ab": "吸" };
    let html = '';
    
    ATTR_KEYS.forEach((key) => {
        // 装備・特性を含めた「最終相性」を取得
        const aff = getFinalAffinity(char, key, "none");
        if (aff === "nm") return; 
        
        const label = AFF_LABELS[aff] || aff.toUpperCase();
        html += `<span class="aff-badge attr-${key}">${label}</span>`;
    });
    
    // 🌟 修正：アイコンがなくても、高さを死守するための箱だけは必ず返す
    return `<div class="p-aff-box" style="min-height:16px; margin-top:2px;">${html}</div>`;
};


// ==========================================
// 🌟 キャラ育成（スキルポイント割り振り）システム
// ==========================================
let growState = { charIdx: -1, tempSp: 0, tempStats: {} };
const GROW_MENU =[
    { key: "maxHp", name: "最大HP", cost: 1, gain: 10, desc: "耐久力の基本" },
    { key: "maxMp", name: "最大MP", cost: 1, gain: 5, desc: "魔力の基本" }, // 🌟 追加
    { key: "maxSt", name: "最大ST", cost: 1, gain: 10, desc: "スタミナの基本" }, // 🌟 追加
    { key: "tech", name: "技術(tech)", cost: 1, gain: 5, desc: "戦闘D/命中率UP" },
    { key: "exp", name: "経験(exp)", cost: 1, gain: 5, desc: "戦闘D/防御力UP" },
    { key: "baseDmg", name: "基礎攻撃力", cost: 1, gain: 1, desc: "HPダメージの底上げ" },
    { key: "baseDef", name: "基礎防御力", cost: 1, gain: 1, desc: "被HPダメージの軽減" },
    { key: "atkShock", name: "衝攻(ATK)", cost: 1, gain: 2, desc: "衝撃ブレイク力の底上げ" },
    { key: "atkHeat", name: "熱攻(ATK)", cost: 1, gain: 2, desc: "熱量ブレイク力の底上げ" },
    { key: "atkElec", name: "電攻(ATK)", cost: 1, gain: 2, desc: "電磁ブレイク力の底上げ" },
    { key: "maxShock", name: "MAX 衝撃耐", cost: 1, gain: 10, desc: "ブレイクされにくくなる" },
    { key: "maxHeat", name: "MAX 熱量耐", cost: 1, gain: 10, desc: "ブレイクされにくくなる" },
    { key: "maxElec", name: "MAX 電磁耐", cost: 1, gain: 10, desc: "ブレイクされにくくなる" },
    { key: "recShock", name: "REC 衝撃回復", cost: 1, gain: 2, desc: "毎ターンの耐性自動回復" },
    { key: "recHeat", name: "REC 熱量回復", cost: 1, gain: 2, desc: "毎ターンの耐性自動回復" },
    { key: "recElec", name: "REC 電磁回復", cost: 1, gain: 2, desc: "毎ターンの耐性自動回復" }
];
window.openGrowModal = function (charIdx) {
    if (state.managementMode !== "camp") {
        state.managementMode = "prep";
    }
    const p = state.player[charIdx];
    growState.charIdx = charIdx;
    growState.tempSp = p.sp || 0;
    growState.tempStats = {}; // 一時的な上昇回数を記録

    GROW_MENU.forEach(menu => { growState.tempStats[menu.key] = 0; });
    renderGrowModal();
    document.getElementById("grow-modal").style.display = "flex";
};

window.closeGrowModal = function () {
    document.getElementById("grow-modal").style.display = "none";
};

window.changeGrowStat = function (key, amount) {
    const p = state.player[growState.charIdx];
    const menu = GROW_MENU.find(m => m.key === key);
    const currentUp = growState.tempStats[key];
    const currentBase = p[key] || 0;
    const totalBaseVal = currentBase + (currentUp * menu.gain);

    // 🌟 追加：キャラ自身の成長限界を取得
    const myLimit = p["limit_" + key] || 9999;

    if (amount > 0) {
        // 次に上げた時に「自身の限界値」を超えないかチェック
        if (growState.tempSp >= menu.cost && (totalBaseVal + menu.gain) <= myLimit) {
            growState.tempSp -= menu.cost;
            growState.tempStats[key]++;
        }
    } else if (amount < 0) {
        if (currentUp > 0) {
            growState.tempSp += menu.cost;
            growState.tempStats[key]--;
        }
    }
    renderGrowModal();
};
window.renderGrowModal = function () {
    const p = state.player[growState.charIdx];
    document.getElementById("grow-title").innerText = `${p.name} の育成`;
    document.getElementById("grow-sp").innerText = growState.tempSp;

    let html = "";
    GROW_MENU.forEach(menu => {
        const currentVal = p[menu.key] || 0; // 現在のベース値
        const addedTimes = growState.tempStats[menu.key]; // 今回足そうとしている回数
        const addedVal = addedTimes * menu.gain;
        const totalBaseVal = currentVal + addedVal; // 装備を含まない合計値

        // キャラ自身の成長限界を取得
        const myLimit = p["limit_" + menu.key] || 9999;
        const isMax = totalBaseVal >= myLimit;

        // 🌟 修正：装備補正（pStats）の計算と bonusText の表示を完全に削除しました

        const isUpDisabled = (growState.tempSp < menu.cost || isMax) ? "disabled" : "";
        const isDownDisabled = addedTimes === 0 ? "disabled" : "";

        const valColor = addedTimes > 0 ? "color: var(--success);" : "color: var(--text-main);";
        const maxLabel = isMax ? `<br><span style="color:#d69e2e; font-weight:bold; font-size:10px; animation:blink 1s infinite;">限界到達！</span>` : "";
        const displayVal = isMax ? `<span style="color:#d69e2e;">${totalBaseVal}</span>` : `${totalBaseVal}`;

        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f7fafc; padding:8px; border:1px solid #cbd5e0; border-radius:4px;">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:14px;">${menu.name} <span style="font-size:10px; color:#718096; font-weight:normal;">(1SP=${menu.gain})</span></div>
                <div style="font-size:10px; color:#718096;">限界: ${myLimit}</div>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
                <!-- ボタン位置を固定（width:30px） -->
                <button class="btn-danger btn-sm" style="padding:2px; width:30px; height:30px; flex-shrink:0;" onclick="changeGrowStat('${menu.key}', -1)" ${isDownDisabled}>-</button>
                
                <!-- 数値表示エリアを固定（width:110px） -->
                <div style="width:110px; text-align:center; font-weight:bold; font-size:16px; ${valColor} line-height:1.2;">
                    ${displayVal} <span style="font-size:10px; color:#a0aec0;">/ ${myLimit}</span>
                    ${maxLabel}
                </div>
                
                <button class="btn-primary btn-sm" style="padding:2px; width:30px; height:30px; flex-shrink:0;" onclick="changeGrowStat('${menu.key}', 1)" ${isUpDisabled}>+</button>
            </div>
        </div>`;
    });
    // 所持している「秘伝書」の一覧を育成画面の下に表示する
    let bookHtml = `<div style="margin-top:15px; border-top:2px solid #cbd5e0; padding-top:10px;">
                        <h4 style="color:#805ad5; margin-bottom:5px;">📜 所持している秘伝書</h4>`;

    let hasBooks = false;
    Object.keys(state.inventory).forEach(itemId => {
        let count = state.inventory[itemId];
        let item = ITEMS[itemId];
        if (count > 0 && item && item.type === "skill_book" && item.teaches_skill) {
            hasBooks = true;
            let targetSkill = SKILLS[item.teaches_skill];
            let skillName = targetSkill ? targetSkill.name : "未知の技";

            // すでに覚えているかチェック
            let alreadyLearned = p.skills && p.skills.includes(item.teaches_skill);
            let btnAttr = alreadyLearned ? "disabled" : `onclick="useSkillBook(${growState.charIdx}, '${itemId}')"`;
            let btnText = alreadyLearned ? "習得済み" : `使う (残${count})`;
            let btnClass = alreadyLearned ? "btn-cancel" : "btn-custom";

            bookHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#faf5ff; padding:8px; border:1px solid #d6bcfa; border-radius:4px; margin-bottom:5px;">
                    <div>
                        <div style="font-weight:bold; font-size:13px;">${item.name}</div>
                        <div style="font-size:10px; color:#553c9a;">技: 【${skillName}】 を覚える</div>
                    </div>
                    <button class="${btnClass} btn-sm" ${btnAttr}>${btnText}</button>
                </div>`;
        }
    });

    if (!hasBooks) bookHtml += `<div style="font-size:12px; color:#a0aec0; text-align:center;">秘伝書を持っていません</div>`;
    bookHtml += `</div>`;

    document.getElementById("grow-list").innerHTML = html + bookHtml;
};

// 🌟 追加：秘伝書を実際に消費して技を覚えさせる関数
window.useSkillBook = function (charIdx, itemId) {
    const p = state.player[charIdx];
    const item = ITEMS[itemId];

    if (!item || item.type !== "skill_book" || !item.teaches_skill) return;
    if (state.inventory[itemId] <= 0) return;

    // 🌟 追加：システム設定の「技の最大数」チェック
    if (state.maxSkills > 0) {
        let currentSkillCount = p.skills ? p.skills.length : 0;
        if (currentSkillCount >= state.maxSkills) {
            alert(`これ以上 技を覚えられないお！\n（最大 ${state.maxSkills} 個まで）`);
            return;
        }
    }

    if (item.usable_ids && item.usable_ids.trim() !== "") {
        const allowedIds = item.usable_ids.split(',').map(s => s.trim());
        if (!allowedIds.includes(p.id) && !allowedIds.includes(p.originalId)) {
            alert(`この秘伝書は ${p.name} には使えないお！`);
            return;
        }
    }

    const targetSkill = SKILLS[item.teaches_skill];
    if (!targetSkill) {
        alert("エラー：この秘伝書に設定された技が存在しません！");
        return;
    }

    if (confirm(`${p.name} に 秘伝書を使って\n技【${targetSkill.name}】を覚えさせますか？\n（※アイテムは無くなります）`)) {
        state.inventory[itemId]--;

        if (!p.skills) p.skills = [];
        p.skills.push(item.teaches_skill);

        showToast(`✨ ${p.name} は 新しい技【${targetSkill.name}】を習得した！`, "success");

        renderGrowModal();
        if (typeof updatePrepUI === 'function') updatePrepUI();
    }
};
window.returnToSystemMenu = function () {
    document.getElementById("grow-modal").style.display = "none";
    state.managementMode = null;

    const sysModal = document.getElementById("system-menu-modal");
    if (sysModal) {
        sysModal.style.display = "flex";
        sysModal.style.pointerEvents = "auto"; // 🌟念のためのロック解除
    }
};
window.confirmGrow = function () {
    const p = state.player[growState.charIdx];
    p.sp = growState.tempSp;

    GROW_MENU.forEach(menu => {
        const addedTimes = growState.tempStats[menu.key];
        if (addedTimes > 0) {
            p[menu.key] = (p[menu.key] || 0) + (addedTimes * menu.gain);
            if (menu.key === "maxHp" && p.hp > 0) p.hp += (addedTimes * menu.gain);

            // 🌟 追加：リセット用に振った回数を記録
            if (!p.growStats) p.growStats = {};
            p.growStats[menu.key] = (p.growStats[menu.key] || 0) + addedTimes;
        }
    });

    saveGame();
    showToast(`✨ ${p.name} の能力を更新したお！`, "success");

    if (document.getElementById("view-result").classList.contains("active")) {
        const moneySpan = document.getElementById("res-money").innerText;
        const expSpan = document.getElementById("res-exp").innerText;
        openResultScreen(moneySpan, expSpan);
    } else {
        if (typeof updatePrepUI === 'function') updatePrepUI();
    }

    if (state.managementMode === "camp") {
        openMemberSelectModal();
    } else {
        closeGrowModal();
    }
};
window.resetGrow = function () {
    if (!confirm("これまでに割り振ったSPをすべてリセットして、ポイントに戻しますか？\n(※装備補正やイベントでの上昇分は消えません)")) return;

    const p = state.player[growState.charIdx];
    if (!p.growStats) {
        showToast("リセットする成長分がありません。", "warning");
        return;
    }

    let refundedSp = 0;
    GROW_MENU.forEach(menu => {
        const times = p.growStats[menu.key] || 0;
        if (times > 0) {
            p[menu.key] -= (times * menu.gain);

            // 最大HPを減らした時は、現在HPも上限に丸める
            if (menu.key === "maxHp" && p.hp > p.maxHp) p.hp = p.maxHp;

            refundedSp += (times * menu.cost);
            p.growStats[menu.key] = 0; // 記録をリセット
        }
    });

    // 🌟 修正：返還されたSPと元のSPを足した結果が、システム上限（9999）を突破しないようにガード！
    p.sp = Math.max(0, Math.min(9999, (p.sp || 0) + refundedSp));
    growState.tempSp = p.sp;

    // 仮振り中のものもリセット
    growState.tempStats = {};
    GROW_MENU.forEach(m => growState.tempStats[m.key] = 0);

    saveGame();
    renderGrowModal();
    showToast(`✨ リセット完了！ ${refundedSp} SP 返還されたお！`, "success");
};
// 敵のAIロジック判定
function getEnemyAction(enemy) {
    if (enemy.status === "provoke") return "normal";
    if (enemy.chargeSkillId) return enemy.chargeSkillId;
    const checkCond = (cond) => {
        // HPによる判定
        if (cond === "hp_75") return (enemy.hp / enemy.maxHp) <= 0.75;
        if (cond === "hp_50") return (enemy.hp / enemy.maxHp) <= 0.5;
        if (cond === "hp_25") return (enemy.hp / enemy.maxHp) <= 0.25;
        if (cond === "turn_1") return state.turnCount === 1;
        if (cond === "turn_2_mul") return state.turnCount % 2 === 0;
        if (cond === "turn_3_mul") return state.turnCount % 3 === 0;
        if (cond === "turn_4_mul") return state.turnCount % 4 === 0;
        if (cond === "turn_5_mul") return state.turnCount % 5 === 0;
        if (cond === "status_any") return enemy.status && enemy.status !== "none";
        if (cond === "status_none") return !enemy.status || enemy.status === "none";
        if (cond === "break_any") return enemy.breakShock > 0 || enemy.breakHeat > 0 || enemy.breakElec > 0;
        if (cond === "target_status_any") return state.player.some(p => p.hp > 0 && p.status && p.status !== "none");
        if (cond === "target_break_any") return state.player.some(p => p.hp > 0 && (p.breakShock > 0 || p.breakHeat > 0 || p.breakElec > 0));
        if (cond === "my_slip") return ["poison", "deadly_poison", "burn", "blaze", "bleed"].includes(enemy.status);
        if (cond === "my_restrict") return ["paralysis", "freeze", "frostbite", "slow"].includes(enemy.status);
        if (cond === "tg_sleep") return state.player.some(p => p.hp > 0 && ["sleep", "stone", "freeze"].includes(p.status));
        if (cond === "tg_buff") return state.player.some(p => p.hp > 0 && ["invincible", "protect", "immovable"].includes(p.status));
        if (cond.startsWith("tac_")) {
            if (!state.tacData) return false;
            let minDist = 999;
            let surroundCount = 0;
            state.player.slice(0, state.battleMemberCount || 3).forEach(p => {
                if (p.hp > 0 && p.x !== undefined) {
                    let dist = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
                    if (dist < minDist) minDist = dist;
                    if (dist === 1) surroundCount++;
                }
            });
            let allyNearCount = 0;
            state.enemy.forEach(e => {
                if (e !== enemy && e.hp > 0 && e.x !== undefined) {
                    if (Math.abs(e.x - enemy.x) + Math.abs(e.y - enemy.y) === 1) allyNearCount++;
                }
            });
            if (cond === "tac_dist_1") return minDist === 1;
            if (cond === "tac_dist_far") return minDist >= 2;
            if (cond === "tac_surrounded") return surroundCount >= 2;
            if (cond === "tac_ally_near") return allyNearCount >= 1;
        }
        if (cond === "random_25") return Math.random() < 0.25;
        if (cond === "random_50") return Math.random() < 0.50;
        if (cond === "always") return true;
        return false;
    };

const canUseSkill = (sid) => {
        if (sid === "normal" || sid === "nothing" || sid === "tension_up") return true;
        let sk = SKILLS[sid];
        if (!sk) return false;

        // 🌟 追加：コスト不足なら候補から外す（これをしないと無駄行動して死ぬ）
        if (state.enableMpSt) {
            let reqMp = sk.cost_mp || 0;
            let reqSt = sk.cost_st || 0;
            if (enemy.mp < reqMp || enemy.st < reqSt) return false;
        }

        // ブレイク中の反動技使用不可のチェック
        if (sk.recoil_shock && enemy.breakShock > 0) return false;
        if (sk.recoil_heat && enemy.breakHeat > 0) return false;
        if (sk.recoil_elec && enemy.breakElec > 0) return false;
        
        return true;
    };

    let aiCards = enemy.ai_cards;
    if (!aiCards || aiCards.length === 0) {
        aiCards = [];
        if (enemy.act1_cond && enemy.act1_cond !== "none") aiCards.push({ cond: enemy.act1_cond, skill: enemy.act1_skill, prob: enemy.act1_prob });
        if (enemy.act2_cond && enemy.act2_cond !== "none") aiCards.push({ cond: enemy.act2_cond, skill: enemy.act2_skill, prob: enemy.act2_prob });
    }

    if (aiCards && aiCards.length > 0) {
        for (let i = 0; i < aiCards.length; i++) {
            let card = aiCards[i];
            if (card.cond && card.cond !== "none" && checkCond(card.cond)) {
                if ((Math.floor(Math.random() * 100) + 1) <= (Number(card.prob) || 100)) {
                    // 🌟 修正：確率を引いても、復旧中で使えない技なら「選ばなかったこと」にして次のカードへ進む
                    if (canUseSkill(card.skill)) {
                        return card.skill;
                    }
                }
            }
        }
    }

    let base1 = enemy.act_base_skill || "normal";
    let base2 = enemy.act_base_skill2 || "none";
    let baseProb = Number(enemy.act_base_prob || 50);

    if (!enemy.act_base_skill && enemy.skills && enemy.skills.length > 0) {
        // ランダム行動時も、使える技の中から選ぶ
        let usableSkills = enemy.skills.filter(s => canUseSkill(s));
        if (usableSkills.length > 0 && Math.random() < 0.4) return usableSkills[Math.floor(Math.random() * usableSkills.length)];
        if (state.enableTension && Math.random() < 0.1) return "tension_up";
        return "normal";
    }

    let finalAction = base1;
    if (base2 !== "none") {
        if ((Math.floor(Math.random() * 100) + 1) <= baseProb) finalAction = base1;
        else finalAction = base2;
    }

    // 🌟 追加：もし最終的に選ばれた基本行動すらブレイク中で使えなかった場合、ただの通常攻撃にダウングレードする
    if (!canUseSkill(finalAction)) {
        finalAction = "normal";
    }

    // ▼ 敵の例外・反復処理
    if (enemy.status === "repetition" && enemy.lastUsedSkill) {
        return enemy.lastUsedSkill;
    }
    if (enemy.status === "exception" && enemy.lastUsedSkill) {
        if (finalAction === enemy.lastUsedSkill) {
            return (enemy.lastUsedSkill === "normal") ? "nothing" : "normal";
        }
    }

    return finalAction;
}
// ==========================================
// キャラメイク用ダイス処理（戦闘ボード統合版）
// ==========================================
window.prepareNextStatRoll = function () {
    let sr = state.currentStatRoll;
    if (sr.currentIndex >= sr.queue.length) {
        applyStatRollResults();
        return;
    }

    let currentTask = sr.queue[sr.currentIndex];
    let count = 1, max = 100, base = 0;

    // 🌟 修正：+だけでなく -（マイナス）も許容する正規表現
    let match = currentTask.exp.match(/(\d+)d(\d+)(?:([+-])(\d+))?/i);
    if (match) {
        count = parseInt(match[1]) || 1;
        max = parseInt(match[2]) || 100;
        let sign = match[3] === '-' ? -1 : 1;
        base = (parseInt(match[4]) || 0) * sign;
    }

    sr.currentConfig = { key: currentTask.key, count, max, base, result: 0, formula: currentTask.exp };
    let keyName = { "maxHp": "最大HP", "maxMp": "最大MP", "maxSt": "最大ST", "tech": "技術(tech)", "exp": "経験(exp)", "baseDmg": "基礎攻撃力", "baseDef": "基礎防御力" }[currentTask.key] || currentTask.key;

    // ① 黒いボード側のUIテキストを準備（まだ隠しておく）
    document.getElementById("stat-dice-header").innerText = `【${keyName}】 の決定`;
    document.getElementById("stat-dice-formula").innerText = `判定式: ${currentTask.exp}`;
    const valEl = document.getElementById("stat-dice-val");
    valEl.innerText = "?";
    valEl.className = "d-val mx-auto";

    // ② 白いストーリー画面側に「ダイスを振る」ボタンだけを出す
    const storyDiceArea = document.getElementById("story-dice-area");
    storyDiceArea.style.display = "flex";
    document.getElementById("story-dice-inst").innerText = `【${keyName}】 を決めます`;

    // イベントをセット
    document.getElementById("btn-roll-story").onclick = executeStatRoll;
};

// 実際にダイスを回す演出
window.executeStatRoll = async function () {
    let sr = state.currentStatRoll;
    if (sr.isRolling) return;
    sr.isRolling = true;

    // ① 白いストーリー枠（振るボタン）を消す
    document.getElementById("story-dice-area").style.display = "none";

    // ② 黒い戦闘ボードを出し、ステータス用の画面に切り替える
    document.getElementById("dice-board").style.display = "block";
    document.getElementById("dice-battle-ui").style.display = "none";
    document.getElementById("dice-hit-ui").style.display = "none";
    document.getElementById("dice-stat-ui").style.display = "block";

    // 回転中は決定ボタンを隠す
    document.getElementById("stat-dice-actions").style.display = "none";

    const valEl = document.getElementById("stat-dice-val");
    let conf = sr.currentConfig;
    let totalRoll = 0;

    // 🌟 ぐるぐる回転演出 (15フレーム・超高速)
    for (let i = 0; i < 15; i++) {
        totalRoll = 0;
        for (let d = 0; d < conf.count; d++) {
            totalRoll += Math.floor(Math.random() * conf.max) + 1;
        }
        valEl.innerText = conf.base + totalRoll;
        await wait(50);
    }

    // 最終結果の確定
    sr.isRolling = false;
    totalRoll = 0;
    for (let d = 0; d < conf.count; d++) {
        totalRoll += Math.floor(Math.random() * conf.max) + 1;
    }
    conf.result = conf.base + totalRoll;
    valEl.innerText = conf.result;

    // 🌟 良い出目なら青く光らせる (最大値の80%以上)
    const maxPossible = (conf.count * conf.max) + conf.base;
    if (conf.result >= maxPossible * 0.8) {
        valEl.classList.add("dice-winner");
        playGlitchEffect();
    }

    await wait(800);

    // ③ ボードの中に「決定」と「振り直し」ボタンを表示する
    document.getElementById("stat-dice-actions").style.display = "flex";

    // 「決定ボタン」に結果の数字を含める（オマケ）
    document.getElementById("btn-stat-accept").innerText = `決定 (${conf.result})`;

    const rerollBtn = document.getElementById("btn-stat-reroll");
    if (sr.remains > 0) {
        rerollBtn.style.display = "block";
        rerollBtn.innerText = `振り直す (残${sr.remains}回)`;
    } else {
        rerollBtn.style.display = "none";
    }
};

window.acceptStatRoll = function () {
    // ボードを閉じて次のダイスへ
    document.getElementById("dice-board").style.display = "none";
    let sr = state.currentStatRoll;
    sr.results[sr.currentConfig.key] = sr.currentConfig.result;
    sr.currentIndex++;
    prepareNextStatRoll();
};

window.retryStatRoll = function () {
    if (state.currentStatRoll.isRolling) return;
    if (state.currentStatRoll.remains > 0) {
        state.currentStatRoll.remains--;
        // ボードは開いたまま、もう一度回転演出へ
        executeStatRoll();
    }
};

function applyStatRollResults() {
    let sr = state.currentStatRoll;
    let p = state.player.find(x => x.id === sr.targetId || x.originalId === sr.targetId) || state.player[0];

    if (p) {
        for (let key in sr.results) {
            // 🌟 追加：出た目が上限を超えていたら、上限に丸める
            const menuDef = typeof GROW_MENU !== 'undefined' ? GROW_MENU.find(m => m.key === key) : null;
            let statMax = menuDef ? menuDef.max : 9999;

            p[key] = Math.min(statMax, sr.results[key]);

            if (key === "maxHp") p.hp = p[key];
        }
        initResistance(p, true);
    }

    document.getElementById("dice-board").style.display = "none";
    state.isWaitingChoice = false;
    state.currentStepIndex++;
    saveGame();
    nextStory();
}





// ==========================================
// オンライン対戦（PvP）P2P通信ロジック
// ==========================================

let peer = null;
let conn = null;
let isHost = false;
let pvpRules = {};
let opponentParty = null;

// 3. オンラインメニューを開く
let isMyRematchReady = false; // 連戦待機用フラグ

window.openOnlineMenu = async function () {
    // 🌟 追加：オフライン、またはPeerJSが読み込めていない場合はブロック
    if (!navigator.onLine || typeof Peer === 'undefined') {
        alert("⚠️ オフライン、または通信プログラムが読み込めませんでした。\nインターネット接続を確認してください。");
        return;
    }

    const hash = await calculateGameHash();
    document.getElementById("online-data-hash").innerText = hash;
    document.getElementById("online-qr-container").style.display = "none";
    document.getElementById("online-qrcode").innerHTML = "";

    isMyRematchReady = false; // ロビーを開くたびに準備状態をリセット

    // 現在のパーティ情報を生成して流し込む
    const listEl = document.getElementById("online-party-list");
    let htmls = [];
    const maxMembers = state.battleMemberCount || 3;

    for (let i = 0; i < maxMembers && i < state.player.length; i++) {
        const p = state.player[i];
        if (!p || p.hp <= 0) continue;

        let eqList = Array.isArray(p.equips) ? p.equips : (p.equip ? [p.equip] : []);
        let eqNames = eqList.map(eid => (eid && ITEMS[eid]) ? ITEMS[eid].name : "").filter(n => n).join(" / ");
        if (!eqNames) eqNames = "なし";

        let cardHtml = await generateCharCardHTML(p, "prep", {
            isActiveChar: false,
            btnHtml: "",
            equipHtml: `<div style="font-size:12px; color:#4a5568; font-weight:bold; margin-top:4px;">🗡️ 装備: <span style="color:#2d3748; font-weight:normal;">${eqNames}</span></div>`
        });
        htmls.push(cardHtml);
    }

    if (htmls.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:10px; color:#e53e3e; font-weight:bold;">出撃できる（生きている）メンバーがいません！</div>`;
    } else {
        listEl.innerHTML = htmls.join("");
    }

    // 🌟 追加：通信接続済みなら「再戦」ボタンを出す
    const prepBlocks = document.querySelectorAll("#view-online .prep-block");
    if (conn && conn.open) {
        // ホスト枠とゲスト枠を隠す
        if (prepBlocks[1]) prepBlocks[1].style.display = "none";
        if (prepBlocks[2]) prepBlocks[2].style.display = "none";

        let rematchDiv = document.getElementById("pvp-rematch-block");
        if (!rematchDiv) {
            rematchDiv = document.createElement("div");
            rematchDiv.id = "pvp-rematch-block";
            rematchDiv.className = "prep-block";
            prepBlocks[0].parentNode.appendChild(rematchDiv);
        }
        rematchDiv.style.display = "block";
        rematchDiv.innerHTML = `
            <h3 style="border-left-color:var(--success);">⚔️ 連戦の準備</h3>
            <div style="text-align:center; padding:10px; background:#f0fff4; border-radius:8px; border:1px solid #9ae6b4;">
                <p style="margin-bottom:10px; color:#276749; font-weight:bold;">対戦相手と接続されています。</p>
                <button id="btn-rematch-ready" class="btn-primary w-100" onclick="toggleRematchReady()">✅ 準備完了（再戦する）</button>
                <button class="btn-danger w-100 mt-3" onclick="disconnectPvP()">🔌 通信を切断してタイトルへ</button>
            </div>
        `;
    } else {
        // 未接続時は元通り
        if (prepBlocks[1]) prepBlocks[1].style.display = "block";
        if (prepBlocks[2]) prepBlocks[2].style.display = "block";
        let rematchDiv = document.getElementById("pvp-rematch-block");
        if (rematchDiv) rematchDiv.style.display = "none";
    }

    changeView("view-online");
};

// 再戦ボタンを押した時の処理
window.toggleRematchReady = function () {
    if (!conn) return;
    isMyRematchReady = !isMyRematchReady;
    const btn = document.getElementById("btn-rematch-ready");

    if (isMyRematchReady) {
        btn.innerText = "⏳ 相手の準備を待っています...";
        btn.className = "btn-warning w-100";
        conn.send({ type: 'REMATCH_READY' });
    } else {
        btn.innerText = "✅ 準備完了（再戦する）";
        btn.className = "btn-primary w-100";
        conn.send({ type: 'REMATCH_CANCEL' });
    }
};

// 通信の完全切断
window.disconnectPvP = function () {
    if (conn) conn.close();
    if (peer) peer.destroy();
    conn = null; peer = null;
    alert("通信を切断しました。タイトル画面に戻ります。");
    changeView("view-title");
};

// 4.[ホスト] 部屋を作る（通信待機）
window.hostOnlineGame = function () {
    isHost = true;
    const hash = document.getElementById("online-data-hash").innerText;

    // ルールの取得
    pvpRules = {
        exp: document.getElementById("pvp-rule-exp").checked,
        res: document.getElementById("pvp-rule-res").checked,
        attr: document.getElementById("pvp-rule-attr").checked,
        skip: document.getElementById("pvp-rule-skip").checked,
        item: document.getElementById("pvp-rule-item").checked,
        equip: document.getElementById("pvp-rule-equip").checked,
        scout: document.getElementById("pvp-rule-scout").checked,
        timeLimit: parseInt(document.getElementById("pvp-rule-time").value) || 0,
        turnLimit: parseInt(document.getElementById("pvp-rule-turn").value) || 0,
        switch: document.getElementById("pvp-rule-switch").checked,
        multiEquip: document.getElementById("pvp-rule-multi-equip").checked,

        // ▼ 追加：タクティカル設定
        isTactical: document.getElementById("pvp-rule-tactical").checked,
        tacInit: document.getElementById("pvp-tac-init").value,
        tacDice: document.getElementById("pvp-tac-dice").value === "true",
        tacMap: document.getElementById("pvp-tac-map").value
    };

    // PeerJSの初期化（ID自動生成）
    if (peer) peer.destroy();
    peer = new Peer();

    peer.on('error', function (err) {
        let errMsg = "通信エラーが発生しました。";
        if (err.type === "peer-unavailable") {
            errMsg = "指定されたホストIDが見つかりません。\nIDが間違っているか、相手が既に部屋を閉じています。";
        }
        alert("❌ " + errMsg + "\n(エラーコード: " + err.type + ")");

        if (conn) { conn.close(); conn = null; }
        if (peer) { peer.destroy(); peer = null; }
    });

    peer.on('open', function (id) {
        document.getElementById("online-host-id").value = id; 

        const qrContainer = document.getElementById("online-qrcode");
        qrContainer.innerHTML = "";
        
        // 🌟 修正：QRCodeライブラリが読み込めている時だけ生成する
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: id,
                width: 150, height: 150, colorDark: "#1a202c", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.L
            });
        } else {
            qrContainer.innerHTML = "<div style='color:#e53e3e; font-size:12px; padding:20px;'>QR生成オフライン</div>";
        }

        document.getElementById("online-qr-container").style.display = "block";
        alert("🌐 部屋を作成しました！\n対戦相手の接続を待っています...");
    });

    // ゲストからの接続要求を受け取る
    peer.on('connection', function (connection) {
        conn = connection;
        setupConnection(conn, hash);
    });
};

// 5. [ゲスト] 部屋に入る（接続実行）
window.joinOnlineGame = function () {
    isHost = false;
    const hash = document.getElementById("online-data-hash").innerText;
    const hostId = document.getElementById("join-host-id").value.trim();

    if (!hostId) { alert("ホストIDを入力してください！"); return; }

    if (peer) peer.destroy();
    peer = new Peer();

    peer.on('open', function () {
        alert("🌐 ホストに接続しています...");
        conn = peer.connect(hostId);

        conn.on('open', function () {
            setupConnection(conn, hash);
            // 接続できたら、まず自分のハッシュ値をホストに送って不正チェック
            conn.send({ type: 'HASH_CHECK', hash: hash });
        });
    });
};

// 6. 通信ハンドラ（データ受信時の処理）
function setupConnection(c, myHash) {
    c.on('data', function (data) {

        if (data.type === 'REMATCH_READY') {
            opponentParty = null; // 古いデータを消して最新をもらう準備
            if (isMyRematchReady) {
                // 両者準備完了！ホストがルールとデータを送って開始トリガーを引く
                if (isHost) {
                    c.send({ type: 'HASH_OK', rules: pvpRules });
                    sendPartyData();
                }
            } else {
                showToast("対戦相手が「準備完了」になりました！", "info");
            }
            return;
        }
        else if (data.type === 'REMATCH_CANCEL') {
            showToast("対戦相手が準備をキャンセルしました。", "warning");
            return;
        }

        // ① ハッシュチェック（チート・データ違い防止）
        if (data.type === 'HASH_CHECK') {
            if (data.hash !== myHash) {
                alert("❌ 対戦相手とシナリオデータが異なります！（ハッシュ不一致）\n同じ冒険の書を読み込んでから対戦してください。");
                c.close();
            } else {
                if (isHost) {
                    // ホストはハッシュが合っていれば、設定したルールをゲストに送る
                    c.send({ type: 'HASH_OK', rules: pvpRules });
                    sendPartyData(); // 続けて自分のパーティデータを送る
                }
            }
        }

        // ② ルール受信（ゲスト側）
        else if (data.type === 'HASH_OK') {
            pvpRules = data.rules;
            alert("✅ 通信確立！ホストからルールを受信しました。データ交換を開始します...");
            sendPartyData(); // ゲストも自分のパーティデータを送る
        }

        // ③ パーティデータの受信
        else if (data.type === 'PARTY_DATA') {
            opponentParty = data.party;
            checkPvPReady();
        }
        // ④ コマンド受信（ホスト側が受け取る）
        else if (data.type === 'COMMANDS') {
            if (isHost) {
                pvpGuestCmds = data.actions;
                checkPvPTurnStart();
            }
        }
        // ⑤ ターン開始合図の受信（ゲスト側が受け取る）
        // (TAC_SETUP_DONE の受信時：お互いの配置が終わった瞬間）
        else if (data.type === 'TAC_SETUP_DONE') {
            state.tacData.opponentPositions = data.positions;

            // 🌟 修正：相手から送られてきた共通のシード値を使って「わざわい」を発動させる
            if (data.seed) {
                enablePvPRandom(data.seed);
                triggerOmenTrait();
            }

            checkPvPTacSetup();
        }

        // （TURN_START の受信時：通常の1vs1/パーティ戦の最初のターン）
        else if (data.type === 'TURN_START') {
            if (!isHost) {
                // 🌟 追加：PvP通常戦の「わざわい」発動
                enablePvPRandom(data.seed);
                if (state.turnCount === 1) triggerOmenTrait();

                startPvPTurn(data.seed, data.hostActions, state.partyBattle.actions.filter(a => a.isPlayer));
            }
        }

        else if (data.type === 'TAC_MOVE_ACTION') {
            // 相手が1手動かした！自分の画面で敵を動かす
            receivePvPTacAction(data);
        }

        else if (data.type === 'TAC_TURN_END') {
            // 相手がターン終了ボタンを押した！自分のターンが来る
            (async () => {
                state.player.slice(0, state.battleMemberCount || 3).forEach(p => { if (p.hp > 0 && p.x !== undefined) processResTurnEnd(p, true); });
                state.enemy.forEach(e => { if (e.hp > 0 && e.x !== undefined) processResTurnEnd(e, false); });

                await processAllStatusTurnEnd();
                state.turnCount++;

                if (await checkTacticalDead()) return;

                state.tacData.turn = "player";
                state.tacData.hasEscapedThisRound = false; // 🌟背水の陣を解除
                state.player.forEach(p => { p.hasActed = false; p.justEscaped = false; });

                showToast("あなたのターンだお！", "success");
                updateTacticalUI();
            })();
        }

        // 相手が盤面決闘から逃げた合図を受け取る
        else if (data.type === 'TAC_ESCAPE_SUCCESS') {
            if (state.tacData && document.getElementById("view-tactical")) {
                showToast("敵が 決闘から逃げ出した！", "warning");
                changeView("view-tactical");
                state.isAnimating = false;
                checkTacticalTurnEnd();
            }
        }

        // 相手から送られてきた「決闘の最終結果」で自分の画面を強制上書きする
        else if (data.type === 'TAC_SYNC_STATUS') {
            let aChar = state.player.find(p => p.id === data.attackerId) || state.enemy.find(e => e.id === data.attackerId);
            let dChar = state.player.find(p => p.id === data.defenderId) || state.enemy.find(e => e.id === data.defenderId);

            if (aChar) {
                aChar.hp = data.aHp; aChar.status = data.aStatus; aChar.statusTurn = data.aStatusTurn;
                aChar.tension = data.aTension;
                aChar.curShock = data.aShock; aChar.curHeat = data.aHeat; aChar.curElec = data.aElec;
            }
            if (dChar) {
                dChar.hp = data.dHp; dChar.status = data.dStatus; dChar.statusTurn = data.dStatusTurn;
                dChar.tension = data.dTension;
                dChar.curShock = data.dShock; dChar.curHeat = data.dHeat; dChar.curElec = data.dElec;
            }
            updateTacticalUI();
        }

        // 全滅の合図を受け取る
        else if (data.type === 'PVP_GAME_OVER') {
            alert(`対戦相手が「${data.result}」を送信してきました。対戦を終了します。`);
            endPvP();
        }
    });

    c.on('close', function () {
        if (state.isPvP) {
            alert("⚠️ 相手との通信が切断されました。\n相手が逃亡したため、あなたの不戦勝です！");
            endPvP(); // 🌟 ここで endPvP を呼べば、cleanupGameState まで全部実行されて安全になる
        } else {
            alert("⚠️ 対戦相手との通信が切断されました。");
            cleanupGameState(); // 🌟 追加：ソロで繋いでいた場合も完全リセット
            changeView('view-title');
        }
    });
}

// 7. 経験値ON/OFFに応じた自分のパーティデータを送信
function sendPartyData() {
    let partyToSend = JSON.parse(JSON.stringify(state.player.slice(0, 3)));

    // 🌟 重複装備のチェックロジック
    if (!pvpRules.multiEquip) {
        let hasViolation = false;
        let violatorName = "";

        partyToSend.forEach(p => {
            if (Array.isArray(p.equips)) {
                // null(空欄)を除いた装備IDのリスト
                let activeEquips = p.equips.filter(e => e && e !== "none");
                // 重複があるか確認 (Setのサイズと配列のサイズを比較)
                let uniqueEquips = new Set(activeEquips);
                if (uniqueEquips.size !== activeEquips.length) {
                    hasViolation = true;
                    violatorName = p.name;
                }
            }
        });

        if (hasViolation) {
            alert(`❌ ルール違反！\nこの部屋は「重複装備禁止」ですが、${violatorName}が同じアイテムを複数装備しています。\n装備を直してから再度接続してください。`);
            if (conn) conn.close(); // 通信切断
            return;
        }
    }

    if (!pvpRules.exp) {
        // ▼ 修正2：経験値OFFの場合、現在のメンバー構成を保ったまま、
        // マスターデータ(初期データ)を参照してステータスだけをLv.1相当にリセットする
        partyToSend.forEach(p => {
            let bId = p.originalId || p.id.split('_')[0];
            const teamMaster = window.customPlayerTeam || INITIAL_PLAYER_TEAM;
            let baseData = teamMaster.find(c => c.id === bId) || ENEMY_MASTER[bId];

            // もしそれでも見つからない場合(配合産など)のバックアップ
            if (!baseData && p.originalId) {
                // p.originalId をキーにしてENEMY_MASTERを再検索
                baseData = ENEMY_MASTER[p.originalId];
            }
            if (baseData) {
                // 🌟修正：ステータスはそのまま（ミニゲーム等で上げた分を維持する）
                // ただし、最大HPが減っていた場合のみマスターデータの値で回復させる
                if (p.maxHp < baseData.maxHp) p.maxHp = baseData.maxHp;
            }

            p.level = 1;
            p.levelExp = 0;
            p.sp = 0;
            p.hp = p.maxHp;
        });
    }

    // 耐性ゲージなどの現在値を初期化して送る
    partyToSend.forEach(p => initResistance(p, true));

    conn.send({ type: 'PARTY_DATA', party: partyToSend });
    checkPvPReady();
}

// 8. お互いのデータが揃ったら対戦画面へ移行
function checkPvPReady() {
    if (opponentParty && conn && conn.open) {
        alert("⚔️ 対戦相手のデータを受信しました！PvPバトルを開始します！");
        startPvPBattle();
    }
}

// 9. PvPバトル初期化処理
window.startPvPBattle = async function () {
    // ▼ 修正3：自分のデータも「先頭3人のみ」に絞る
    let myParty = JSON.parse(JSON.stringify(state.player.slice(0, 3)));

    if (!pvpRules.exp) {
        // ▼ 修正4：経験値OFF時は、自分の画面のキャラもLv.1相当にリセットする
        myParty.forEach(p => {
            let bId = p.originalId || p.id.split('_')[0];
            const teamMaster = window.customPlayerTeam || INITIAL_PLAYER_TEAM;
            let baseData = teamMaster.find(c => c.id === bId) || ENEMY_MASTER[bId];

            if (baseData) {
                // 🌟修正：ステータスはそのまま（ミニゲーム等で上げた分を維持する）
                // ただし、最大HPが減っていた場合のみマスターデータの値で回復させる
                if (p.maxHp < baseData.maxHp) p.maxHp = baseData.maxHp;
            }
            p.level = 1; p.levelExp = 0; p.sp = 0; p.hp = p.maxHp;
        });
    }

    myParty.forEach(p => initResistance(p, true));
    myParty.forEach(p => p.id = p.id + (isHost ? "_host" : "_guest"));
    opponentParty.forEach(e => e.id = e.id + (!isHost ? "_host" : "_guest"));
    state.pvpMyInitialCount = myParty.length;
    [...myParty, ...opponentParty].forEach(c => {
        c.isFirstTurn = true;
        c.turnInBattle = 0;
        c.hasDoubleStrike = false;
        c.critCount = 0;
        c.hitCombo = 0;
    });

    state.pvpBackupPlayer = JSON.parse(JSON.stringify(state.player));
    state.pvpBackupInventory = JSON.parse(JSON.stringify(state.inventory));
    state.pvpBackupOwnedEquips = JSON.parse(JSON.stringify(state.ownedEquips));
    state.player = myParty; // 抽出・リセットした3人だけを自分の操作キャラにする

    // 相手のデータを「敵(enemy)」としてセット
    state.enemy = opponentParty;
    state.enemy.forEach(e => {
        if (!e.maxHp) e.maxHp = e.hp; // 念のためのフェイルセーフ

        // ▼ 追加：PvP中は、相手キャラが「敵AI」として勝手に動かないようにAI設定をすべて消去する
        e.act1_cond = "none"; e.act2_cond = "none";
        e.act_base_skill = "none"; e.act_base_skill2 = "none";
        e.trigger_id = null; e.death_scene = null; // ギミックイベントも無効化
    });
    state.pvpBackupSettings = {
        enableLevelUp: state.enableLevelUp,
        enableResistance: state.enableResistance,
        enableAttribute: state.enableAttribute,
        skipHitDice: state.skipHitDice,
        enablePartyBattle: state.enablePartyBattle,
        enableItemUse: state.enableItemUse,
        enableEquipChange: state.enableEquipChange,
        enableScout: state.enableScout,
        timeLimit: state.timeLimit,
        turnLimit: state.turnLimit,
        enableSwitch: state.enableSwitch,
        enableMultiEquip: state.enableMultiEquip
    };

    // システム設定をホストのルールで強制上書き
    state.enableLevelUp = false; // 対戦では成長しない
    state.enableResistance = pvpRules.res;
    state.enableAttribute = pvpRules.attr;
    state.skipHitDice = pvpRules.skip;
    state.enablePartyBattle = true; // PvPは強制的にパーティバトルUIを使用
    state.enableItemUse = pvpRules.item ? "true" : "false";
    state.enableEquipChange = pvpRules.equip ? "true" : "false";
    state.enableScout = pvpRules.scout ? "true" : "false";
    state.pvpTimeLimit = pvpRules.timeLimit || 0;
    state.timeLimit = pvpRules.timeLimit || 0;
    state.turnLimit = pvpRules.turnLimit || 0;
    state.enableSwitch = pvpRules.switch; 
    state.enableMultiEquip = pvpRules.multiEquip;
    
    state.activeP = 0;
    state.activeE = 0;
    state.battleFlags = { guaranteeHit: false, transformCrit: false, guaranteeDodge: false, counterActive: false, statBuff: 0, earnedMoney: 0, earnedExp: 0, resUpShock: false, resUpElec: false, scoutedList: [] };
    state.isPvP = true; // PvPモードフラグ


    // ▼▼▼ ここから追加・修正 ▼▼▼
    if (pvpRules.isTactical) {
        state.tacData = {
            initiative: pvpRules.tacInit,
            useBattleDice: pvpRules.tacDice,
            // 🌟 修正：改行コードのゴミ（\r）を完全に除去して安全に配列化する！
            mapGrid: pvpRules.tacMap ? pvpRules.tacMap.split(/\r?\n/) : Array(9).fill("........."),
            phase: "setup_player", // 配置フェーズからスタート
            selectedUnit: null,
            movedUnit: null,
            turn: "player",
            isPvP: true // PvP専用盤面フラグ
        };

        // 全員の座標を未配置にリセット
        state.player.forEach(p => { p.x = -1; p.y = -1; p.hasActed = false; });
        state.enemy.forEach(e => { e.x = -1; e.y = -1; e.hasActed = false; });

        changeView("view-tactical");
        sysLog(`[システム] オンライン・タクティカルバトル開始！`);

        // PvP専用の盤面構築へ流す
        initPvPTacticalBoard();
        return; // ここで処理を終了し、通常のバトル画面には行かせない
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    // 通常の対戦画面へ移行
    changeView("view-battle");
    sysLog(`[システム] オンライン対戦開始！`);

    updateUI();
    await showMsg(`オンライン対戦の準備が完了しました！\nあなたは ${isHost ? 'ホスト' : 'ゲスト'} です。`);
};

// ==========================================
// PvP用：完全同期型・乱数生成器
// ==========================================
const originalMathRandom = Math.random;
let pvpSeed = 0;
let isPvPRandomActive = false;

function seededRandom() {
    let t = pvpSeed;
    t ^= t << 13;
    t ^= t >> 17;
    t ^= t << 5;
    pvpSeed = t;
    return (t >>> 0) / 4294967296;
}

window.enablePvPRandom = function(seed) {
    pvpSeed = seed || 123456789;
    isPvPRandomActive = true;
};
window.disablePvPRandom = function() {
    isPvPRandomActive = false;
};
Math.random = function () {
    if (isPvPRandomActive) return seededRandom();
    return originalMathRandom();
};

// UIや演出など「対戦結果に関係ない場所」で使う乱数はこっち！
window.uiRandom = function () {
    return originalMathRandom();
};
// ==========================================
// PvP用：進行管理ロジック
// ==========================================
let pvpHostCmds = null;
let pvpGuestCmds = null;

// 自分のコマンド入力を終えた時の処理
async function onPvPCommandsReady() {
    stopPvPTimer();
    await showMsg(`相手の コマンド入力 を 待っています...`);
    document.getElementById("cmd-main").style.display = "none";

    let myCmds = state.partyBattle.actions.filter(a => a.isPlayer);

    if (isHost) {
        pvpHostCmds = myCmds;
        checkPvPTurnStart();
    } else {
        conn.send({ type: 'COMMANDS', actions: myCmds });
    }
}

// ホスト側：両者のコマンドが揃ったら乱数を作ってターンを始める
function checkPvPTurnStart() {
    if (pvpHostCmds && pvpGuestCmds) {
        // ターン用の「乱数の種」を決定
        const seed = Math.floor(originalMathRandom() * 4294967296);

        // ゲストに「この乱数でお互いのコマンドを実行しろ」と命令する
        conn.send({ type: 'TURN_START', seed: seed, hostActions: pvpHostCmds });

        // ホスト自身もターン開始
        startPvPTurn(seed, pvpHostCmds, pvpGuestCmds);

        // 次のターンのためにリセット
        pvpHostCmds = null; pvpGuestCmds = null;
    }
}

// ゲスト/ホスト共通：送られてきたコマンドを統合して実行
async function startPvPTurn(seed, hostCmds, guestCmds) {
    enablePvPRandom(seed); // 乱数同期オン
    state.partyBattle.phase = 'execute';

    // ゲスト/ホスト共通：送られてきたコマンドを統合して実行
    let finalActions = [];

    // ホストのコマンドを自分視点に変換して登録
    hostCmds.forEach(act => {
        finalActions.push({
            isPlayer: isHost, // ホストなら味方(true)、ゲストなら敵(false)
            actorIdx: act.actorIdx,
            action: act.action,
            param: act.param,
            targetIdx: act.targetIdx
        });
    });

    // ゲストのコマンドを自分視点に変換して登録
    guestCmds.forEach(act => {
        finalActions.push({
            isPlayer: !isHost, // ホストなら敵(false)、ゲストなら味方(true)
            actorIdx: act.actorIdx,
            action: act.action,
            param: act.param,
            targetIdx: act.targetIdx
        });
    });

    // 構築したアクションリストをセットして実行
    state.partyBattle.actions = finalActions;
    await executePartyTurn();
}

// PvP専用：勝敗判定ロジック
async function checkPvPDead() {
    let pAlive = state.player.slice(0, state.battleMemberCount || 3).some(p => p && p.hp > 0);
    let eAlive = state.enemy.some(e => e && e.hp > 0);

    // 🌟 修正3：ここを追加！ PvPのタクティカル決闘中なら盤面へ帰る！
    if (state.tacData) {
        if (!pAlive || !eAlive) {
            state.isAnimating = false;
            await returnToTacticalBoard(state.player[0], state.enemy[0]);
            return true;
        }
        return false;
    }


    // 🌟 修正：敵味方同時に死んでいたら、勝者なき相打ちルートへ飛ぶ！
    if (!pAlive && !eAlive) {
        await showMsg(`<span style="color:#805ad5; font-size:24px;">【相打ち】</span><br>おたがいに 力尽きたお……`);
        await wait(800);

        if (state.isPvP) {
            endPvP();
            return true;
        }

        state.tacData = null;
        jumpTo(state.battleDrawNext || state.battleLoseNext);
        return true;
    }

    if (!eAlive && !pAlive) {
        await showMsg(`<span style="color:#ecc94b; font-size:24px;">【相打ち】</span><br>おたがいの パーティが 力尽きたお！`);
        await wait(800);
        endPvP();
        return true;
    }

    if (!eAlive) {
        await showMsg(`<span style="color:#38a169; font-size:24px;">【勝利！！】</span><br>相手のパーティを ぜんめつさせたお！`);
        await wait(800);
        endPvP();
        return true;
    }

    if (!pAlive) {
        await showMsg(`<span style="color:#e53e3e; font-size:24px;">【敗北...】</span><br>こちらのパーティが ぜんめつしたお...`);
        await wait(800);
        endPvP();
        return true;
    }

    return false;
}
window.endPvP = function (disconnect = true) {
    state.isPvP = false;
    
    // 🌟 追加：タイマーと乱数同期を確実に停止
    if (typeof stopPvPTimer === "function") stopPvPTimer();
    if (typeof disablePvPRandom === "function") disablePvPRandom();

    if (disconnect) {
        if (typeof conn !== "undefined" && conn) { conn.close(); conn = null; }
        if (typeof peer !== "undefined" && peer) { peer.destroy(); peer = null; }
    }

    state.tacData = null;
    state.partyBattle = null; // 🌟 追加：行動キューを破棄
    state.isAnimating = false;
    isSkipping = false;
    document.querySelector(".app-container").style.pointerEvents = "auto";

    if (typeof closeSub === 'function') closeSub();
    const diceBoard = document.getElementById("dice-board");
    if (diceBoard) diceBoard.style.display = "none";
    const battleCutin = document.getElementById("battle-cutin");
    if (battleCutin) battleCutin.style.display = "none";

    // --- キャラクター・アイテムの復元 ---
     if (state.pvpBackupPlayer) {
        // 🌟 修正：固定の3ではなく、記録しておいた「実際の出撃人数」を使う！
        const initialPvPCount = state.pvpMyInitialCount || Math.min(3, state.pvpBackupPlayer.length);
        const scoutedInPvP = state.player.slice(initialPvPCount);

        state.player = JSON.parse(JSON.stringify(state.pvpBackupPlayer));
        scoutedInPvP.forEach(newChar => {
            if (state.player.length < state.maxPlayerCount) {
                newChar.id = newChar.id.replace("_host", "").replace("_guest", "");
                newChar.hp = newChar.maxHp;
                newChar.status = "none";
                newChar.statusTurn = 0;
                if (typeof initResistance === "function") initResistance(newChar, true);
                state.player.push(newChar);
            }
        });
        delete state.pvpBackupPlayer;
    delete state.pvpMyInitialCount; // 🌟 記録を消す
    }

    if (state.pvpBackupInventory) {
        state.inventory = JSON.parse(JSON.stringify(state.pvpBackupInventory));
        delete state.pvpBackupInventory;
    }
    if (state.pvpBackupOwnedEquips) {
        state.ownedEquips = JSON.parse(JSON.stringify(state.pvpBackupOwnedEquips));
        delete state.pvpBackupOwnedEquips;
    }

    if (state.pvpBackupSettings) {
        Object.assign(state, state.pvpBackupSettings);
        delete state.pvpBackupSettings;
    }

    state.enemy = []; // 敵のゴーストデータを抹消

    // 🌟 挿入箇所：キャラをきれいに掃除する
    if (state.player) {
        state.player.forEach(p => cleanUpCharacterBattleFlags(p));
    }

    saveGame(); // ここで保存

    if (disconnect) {
        alert("対戦が終了しました。タイトル画面に戻ります。");
        changeView("view-title");
    } else {
        alert("対戦が終了しました。オンラインロビーに戻ります。");
        changeView("view-online");
    }
};
// ==========================================
// 🔐 強固なデータ整合性チェック（ハッシュ生成）
// ==========================================
window.calculateGameHash = async function () {
    const gf = await loadFromIndexedDB(STORE_GLOBAL, 'flags') || {};

    const targetData = {
        SCENARIO: typeof SCENARIO !== 'undefined' ? SCENARIO : {},
        ENEMY_MASTER: typeof ENEMY_MASTER !== 'undefined' ? ENEMY_MASTER : {},
        ITEMS: typeof ITEMS !== 'undefined' ? ITEMS : {},
        SKILLS: typeof SKILLS !== 'undefined' ? SKILLS : {},
        GLOBAL_FLAGS: gf
    };

    const str = JSON.stringify(targetData);

    let h1 = 0x811c9dc5;
    let h2 = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        h1 ^= char;
        h1 = (h1 * 0x01000193) >>> 0;
        h2 = (h2 + char) >>> 0;
    }

    const part1 = h1.toString(36).toUpperCase().padStart(4, '0').slice(-4);
    const part2 = h2.toString(36).toUpperCase().padStart(4, '0').slice(-4);

    return `${part1}-${part2}`;
};


// ==========================================
// QRコードスキャナー（カメラ）ロジック
// ==========================================
let qrVideo = null;
let qrCanvas = null;
let qrCtx = null;
let scanAnimationId = null;

window.startQRScan = async function () {
    // 🌟 追加：jsQRライブラリが読み込めていない場合はブロック
    if (typeof jsQR === 'undefined') {
        alert("⚠️ QR読み取りプログラムが読み込めませんでした。\nお手数ですが、ホストIDを手動で入力してください。");
        return;
    }
    qrVideo = document.getElementById("qr-video");
    qrCanvas = document.getElementById("qr-canvas");
    qrCtx = qrCanvas.getContext("2d", { willReadFrequently: true });

    try {
        // カメラの使用許可をリクエスト
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        qrVideo.srcObject = stream;
        qrVideo.setAttribute("playsinline", true);
        qrVideo.play();

        document.getElementById("qr-scan-modal").style.display = "flex";
        scanAnimationId = requestAnimationFrame(scanTick);
    } catch (err) {
        alert("カメラの起動に失敗しました。カメラの使用を許可してください。");
    }
};

function scanTick() {
    if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
        // ビデオの1フレームをキャンバスに描画して解析
        qrCanvas.height = qrVideo.videoHeight;
        qrCanvas.width = qrVideo.videoWidth;
        qrCtx.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);

        const imageData = qrCtx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            // QRコードの読み取りに成功！
            console.log("QRコード検出:", code.data);
            processScannedData(code.data);
            return; // 解析終了
        }
    }
    scanAnimationId = requestAnimationFrame(scanTick);
}

function processScannedData(data) {
    stopQRScan();

    // ホストIDが直接入っている想定（将来的にハッシュ等が含まれても対応できるようtrim）
    const hostId = data.trim();
    if (hostId) {
        document.getElementById("join-host-id").value = hostId;
        alert(`IDを取得しました: ${hostId}\n接続を開始します！`);
        joinOnlineGame(); // そのまま接続処理を実行
    }
}

window.stopQRScan = function () {
    if (scanAnimationId) cancelAnimationFrame(scanAnimationId);
    if (qrVideo && qrVideo.srcObject) {
        qrVideo.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById("qr-scan-modal").style.display = "none";
};
// ==========================================
// 簡易2Dマップエンジン (タクティカル描画完全統合版)
// ==========================================
let mapState = { 
    grid: [], w: 0, h: 0, px: 0, py: 0, type: 'top', 
    events: {}, loopId: null, isJumping: false, isJumpingToScene: false,
    startX: 0, startY: 0, 
    jumpTimers: []        
};

window.clearMapTimers = function() {
    if (typeof stopMapMove === 'function') stopMapMove();
    if (mapState.jumpTimers && mapState.jumpTimers.length > 0) {
        mapState.jumpTimers.forEach(id => clearTimeout(id));
        mapState.jumpTimers = [];
    }
    mapState.isJumping = false;
};

window.startMapMode = function (step) {
    if (!step.mapData) {
        alert("マップデータが設定されていません。エディタでマップを作成してください。");
        changeView("view-title");
        return;
    }

    changeView("view-map");
    mapState.type = step.viewType || "top";
    mapState.events = {};
    mapState.isJumpingToScene = false; 
    clearMapTimers();

    if (step.events) {
        step.events.split(",").forEach(e => {
            let [k, v] = e.split(":");
            if (k && v) mapState.events[k.trim()] = v.trim();
        });
    }

    let lines = step.mapData.trim().split('\n');
    mapState.h = lines.length;
    mapState.w = Math.max(...lines.map(l => l.length));
    mapState.grid = [];

    let startX = -1, startY = -1;

    for (let y = 0; y < mapState.h; y++) {
        let row = [];
        let lineText = lines[y] || "";
        for (let x = 0; x < mapState.w; x++) {
            let char = lineText[x];
            if (char === undefined) char = '#'; 
            
            if (char === 'S') {
                startX = x; startY = y;
                char = '.';
            }
            row.push(char);
        }
        mapState.grid.push(row);
    }

    if (startX !== -1) {
        mapState.startX = startX;
        mapState.startY = startY;
    } else {
        mapState.startX = 1; mapState.startY = 1; 
    }

    const isSameMap = (state.lastMapSceneId === state.currentSceneId);
    let px = 1, py = 1;
    
    if (isSameMap && state.lastMapPos) {
        px = state.lastMapPos.x;
        py = state.lastMapPos.y;
    } else if (startX !== -1) {
        px = startX;
        py = startY;
    }

    // 🌟 究極の安全装置：復帰した座標が「壁」や「範囲外」なら、S または 最初の床 に戻す
    if (py >= mapState.h || px >= mapState.w || py < 0 || px < 0 || !mapState.grid[py] || mapState.grid[py][px] === '#') {
        if (startX !== -1) {
            px = startX; py = startY;
        } else {
            let found = false;
            for(let y=0; y<mapState.h; y++){
                for(let x=0; x<mapState.w; x++){
                    if(mapState.grid[y][x] === '.') {
                        px = x; py = y; found = true; break;
                    }
                }
                if(found) break;
            }
        }
    }

    mapState.px = px;
    mapState.py = py;
    state.lastMapSceneId = state.currentSceneId;

    (async () => {
        await drawMap();
        if (mapState.loopId) clearInterval(mapState.loopId);
        if (mapState.type === "side") {
            mapState.loopId = setInterval(mapGravity, 250); 
        }
    })();
};

async function drawMap() {
    const gridEl = document.getElementById("map-grid");
    
    // 🌟 CSSのGrid設定を適用
    gridEl.className = mapState.type === "iso" ? "grid-board iso-view" : "grid-board";

    // 🌟 タクティカルと同じように、画面サイズに合わせてマスの大きさを計算
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    let maxCellW = Math.floor((screenWidth - 40) / mapState.w); // 左右の余白を考慮
    let maxCellH = Math.floor((screenHeight - 150) / mapState.h);
    let cellSize = Math.min(maxCellW, maxCellH);
    cellSize = Math.max(30, Math.min(80, Math.floor(cellSize))); 
    
    // CSSの変数にサイズを流し込む
    document.documentElement.style.setProperty('--tac-cell-size', `${cellSize}px`);

    gridEl.style.gridTemplateColumns = `repeat(${mapState.w}, var(--tac-cell-size))`;
    gridEl.style.gridTemplateRows = `repeat(${mapState.h}, var(--tac-cell-size))`;
    gridEl.innerHTML = ""; 

    // マス目の生成
    for (let y = 0; y < mapState.h; y++) {
        for (let x = 0; x < mapState.w; x++) {
            let char = mapState.grid[y][x];
            let cell = document.createElement("div");
            cell.id = `mcell-${x}-${y}`;
            
            cell.className = "map-tile";
            if (char === '#') cell.classList.add("tile-wall");
            else if (char === '.') cell.classList.add("tile-floor");
            else {
                cell.classList.add("tile-event");
                cell.innerText = char;
            }
            gridEl.appendChild(cell);
        }
    }
    
    // プレイヤーAAの取得
    let pChar = state.player[0];
    let faceAA = "👤"; 
    if (pChar) {
        let isPinch = (pChar.hp <= pChar.maxHp / 2);
        pChar.tempEmotion = isPinch ? "ピンチ" : "通常";
        faceAA = await getFace(pChar);
        pChar.tempEmotion = null; 
        faceAA = faceAA.replace(/^\n+|\n+$/g, '');
    }

    // 🌟 プレイヤーのコマを作成
    let pEl = document.createElement("div");
    pEl.id = "map-player";
    // avatar-slot と avatar-aa を使って綺麗にAAを収める
    pEl.className = "map-tile tile-player avatar-slot player"; 
    pEl.innerHTML = `<pre class="avatar-aa" id="map-player-aa" style="color:#63b3ed;">${faceAA}</pre>`;

    // 🌟 コマを初期位置のマス（セル）の「中」に入れる
    let targetCell = document.getElementById(`mcell-${mapState.px}-${mapState.py}`);
    if (targetCell) {
        targetCell.appendChild(pEl);
        applyAAScale("map-player-aa", cellSize);
    }
}

window.moveMap = async function (dx, dy) {
    if (mapState.isJumpingToScene || state.isAnimating || isMsgTyping) return;
    const msgBox = document.getElementById("story-message-box");
    if (msgBox && msgBox.style.display === "block") return;

    let nx = mapState.px + dx;
    let ny = mapState.py + dy;

    // 穴に落ちた場合
    if (ny >= mapState.h) {
        stopMapMove(); 
        state.isAnimating = true; 
        await showMsg("穴に落ちてしまったお！");
        state.isAnimating = false; 

        mapState.px = mapState.startX;
        mapState.py = mapState.startY;
        
        let pEl = document.getElementById("map-player");
        let targetCell = document.getElementById(`mcell-${mapState.px}-${mapState.py}`);
        if (pEl && targetCell) targetCell.appendChild(pEl);
        return;
    }

    // 画面外ブロック
    if (nx < 0 || nx >= mapState.w || ny < 0) return;

    // 壁ブロック（虚無マスも壁扱い）
    if (!mapState.grid[ny] || mapState.grid[ny][nx] === undefined || mapState.grid[ny][nx] === '#') return;

    mapState.px = nx;
    mapState.py = ny;
    
    // 🌟 座標計算ではなく、「移動先のマスにDOMをブチ込む」方式に変更
    const pEl = document.getElementById("map-player");
    const targetCell = document.getElementById(`mcell-${nx}-${ny}`);
    if (pEl && targetCell) {
        targetCell.appendChild(pEl);
    }

    checkMapEvent();
};

let mapMoveInterval = null;

window.stopMapMove = function () {
    if (mapMoveInterval) {
        clearInterval(mapMoveInterval);
        mapMoveInterval = null;
    }
};

window.startMapMove = function (dx, dy) {
    stopMapMove(); 
    window.moveMap(dx, dy); 

    mapMoveInterval = setInterval(() => {
        window.moveMap(dx, dy);
    }, 200);
};

function mapGravity() {
    if (mapState.isJumping || mapState.isJumpingToScene || state.isAnimating) return;
    moveMap(0, 1);
}

window.actionMap = function () {
    if (mapState.isJumpingToScene || state.isAnimating || isMsgTyping) return;

    if (mapState.type === "side") {
        if (mapState.isJumping) return;
        
        if (mapState.py + 1 >= mapState.h || (mapState.grid[mapState.py + 1] && mapState.grid[mapState.py + 1][mapState.px] === '#')) {
            mapState.isJumping = true;
            mapState.jumpTimers = []; 
            
            moveMap(0, -1);
            mapState.jumpTimers.push(setTimeout(() => moveMap(0, -1), 100));
            mapState.jumpTimers.push(setTimeout(() => moveMap(0, -1), 200));
            mapState.jumpTimers.push(setTimeout(() => moveMap(0, -1), 300));
            mapState.jumpTimers.push(setTimeout(() => { mapState.isJumping = false; }, 500));
        }
        checkMapEvent(true);
    } else {
        checkMapEvent(true);
    }
};

function checkMapEvent(isAction = false) {
    let currentCell = mapState.grid[mapState.py][mapState.px];

    if (currentCell !== '.' && currentCell !== '#' && mapState.events[currentCell]) {
        let isUpperCase = currentCell.toUpperCase() === currentCell && currentCell.toLowerCase() !== currentCell;

        if ((isUpperCase && isAction) || (!isUpperCase && !isAction)) {
            let eventDef = mapState.events[currentCell];
            if (eventDef.includes('%')) {
                let parts = eventDef.split('%');
                let prob = Number(parts[0]);
                if ((Math.floor(Math.random() * 100) + 1) > prob) return;
                eventDef = parts[1];
            }
            triggerMapEvent(currentCell, eventDef);
            return;
        }
    }

    if (isAction && mapState.type !== "side") {
        const adjs = [ { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 } ];
        for (let d of adjs) {
            let nx = mapState.px + d.x; let ny = mapState.py + d.y;
            if (nx >= 0 && nx < mapState.w && ny >= 0 && ny < mapState.h) {
                if (mapState.grid[ny] && mapState.grid[ny][nx]) {
                    let adjCell = mapState.grid[ny][nx];
                    if (adjCell !== '.' && adjCell !== '#' && mapState.events[adjCell] && adjCell === adjCell.toUpperCase()) {
                        triggerMapEvent(adjCell);
                        return;
                    }
                }
            }
        }
    }
}

function triggerMapEvent(cellChar, overrideEventId) {
    if (mapState.isJumpingToScene) return; 
    mapState.isJumpingToScene = true;      

    if (mapState.loopId) clearInterval(mapState.loopId);
    
    clearMapTimers();

    state.lastMapPos = { x: mapState.px, y: mapState.py };

    state.currentStepIndex++;
    saveGame();
    jumpTo(overrideEventId || mapState.events[cellChar]);
}

// ==========================================
// 技の装備（入れ替え）機能
// ==========================================
window.changeEquipSkill = function (pIdx, slotIdx, skillId) {
    const p = state.player[pIdx];
    if (!p.equipSkills) {
        p.equipSkills = p.skills.slice(0, state.maxSkills);
    }

    // ▼ 追加：他のスロットで既に同じ技を装備していたら、その古いスロットを空にする
    if (skillId !== "none") {
        for (let i = 0; i < state.maxSkills; i++) {
            if (i !== slotIdx && p.equipSkills[i] === skillId) {
                p.equipSkills[i] = null;
            }
        }
    }

    p.equipSkills[slotIdx] = skillId === "none" ? null : skillId;

    // ▼ 追加：古いスロットが空になったことを画面に反映させるため、UIを再描画する
    updatePrepUI();
};

// ==========================================
// 預かり所（パーティ編成）機能
// ==========================================
window.openStorage = function () {
    changeView("view-storage");
    updateStorageUI();
};
window.updateStorageUI = function () {
    let partyHtml = "", travelHtml = "", reserveHtml = "";
    let currentTotalCost = 0;

    const maxParty = state.battleMemberCount || 3;
    const travelPartyLimit = 8; // 同行枠の上限

    state.player.forEach((p, i) => {
        let pCost = p.cost || 0;
        let btn = "";

        // 🌟 追加：一軍と同行枠のキャラには「上・下」へ移動するボタンをつける
        let upDownBtn = "";
        if (i < travelPartyLimit) {
            let upDisabled = (i === 0) ? "disabled style='opacity:0.3;'" : "";
            let downDisabled = (i === travelPartyLimit - 1 || i === state.player.length - 1) ? "disabled style='opacity:0.3;'" : "";
            upDownBtn = `
                <div style="display:flex; gap:2px; margin-bottom:5px;">
                    <button class="btn-custom btn-sm" style="flex:1; padding:2px;" onclick="movePartyOrder(${i}, -1)" ${upDisabled}>▲ 上へ</button>
                    <button class="btn-custom btn-sm" style="flex:1; padding:2px;" onclick="movePartyOrder(${i}, 1)" ${downDisabled}>▼ 下へ</button>
                </div>
            `;
        }

        // 🌟 3段階のボタン表示ロジック（矢印ボタンを合体させる）
        if (i < maxParty) {
            btn = `${upDownBtn}<button class="btn-cancel btn-sm w-100" onclick="moveToReserve(${i})">はずす</button>`;
        } else if (i < travelPartyLimit) {
            btn = `${upDownBtn}
                <div style="display:flex; gap:2px;">
                    <button class="btn-success btn-sm" style="flex:1; padding:4px;" onclick="moveToParty(${i}, ${maxParty})">一軍へ</button>
                    <button class="btn-cancel btn-sm" style="flex:1; padding:4px;" onclick="moveToReserve(${i})">倉庫へ</button>
                </div>`;
        } else {
            btn = `<button class="btn-info btn-sm w-100" onclick="moveToParty(${i}, ${travelPartyLimit})">同行させる</button>`;
        }

        let costLabel = state.maxPartyCost > 0 ? `<span style="background:#fed7d7; color:#c53030; padding:2px 4px; border-radius:4px; font-size:10px; margin-left:5px;">Cost:${pCost}</span>` : "";

        let html = `<div class="prep-char-card" style="margin-bottom:5px;">
                        <div style="flex:1;"><b>${p.name}</b> <span class="lv">Lv.${p.level}</span> ${costLabel} <br><span style="font-size:11px; color:#718096;">(HP:${p.hp}/${p.maxHp})</span></div>
                        <div style="display:flex; flex-direction:column; gap:5px; width:100px;">${btn}</div>
                    </div>`;

        if (i < maxParty) {
            partyHtml += html;
            currentTotalCost += pCost;
        } else if (i < travelPartyLimit) {
            travelHtml += html;
        } else {
            reserveHtml += html;
        }
    });

    if (!partyHtml) partyHtml = "<div style='color:#718096; font-size:12px;'>一軍がいません</div>";
    if (!travelHtml) travelHtml = "<div style='color:#718096; font-size:12px;'>同行メンバーがいません</div>";
    if (!reserveHtml) reserveHtml = "<div style='color:#718096; font-size:12px;'>倉庫は空です</div>";

    // HTMLに同行枠を追加して流し込む
    document.getElementById("storage-party-list").innerHTML = partyHtml;
    document.getElementById("storage-reserve-list").innerHTML = 
        `<h4 style="color:#2b6cb0; margin-bottom:5px;">🚶 同行メンバー (戦闘で交代可能)</h4>` + travelHtml +
        `<h4 style="color:#718096; margin-top:15px; margin-bottom:5px; border-top:1px dashed #cbd5e0; padding-top:10px;">📦 倉庫 (待機)</h4>` + reserveHtml;

    let partyTitle = document.querySelector("#view-storage .prep-block h3");
    if (partyTitle) partyTitle.innerText = `現在の一軍 (最大 ${maxParty} 体)`;

    const finishBtn = document.querySelector("#view-storage .bottom-footer button");
    if (state.maxPartyCost > 0) {
        let isOver = currentTotalCost > state.maxPartyCost;
        if (isOver) { finishBtn.disabled = true; finishBtn.innerText = "コストオーバーだお！"; finishBtn.className = "btn-cancel w-100"; } 
        else { finishBtn.disabled = false; finishBtn.innerText = "編成完了"; finishBtn.className = "btn-primary w-100"; }
    }
};

// 🌟 追加：預かり所でキャラの順番を入れ替える関数
window.movePartyOrder = function(index, dir) {
    const travelPartyLimit = 8;
    const newIndex = index + dir;

    // 同行枠(0〜7)の範囲外にはみ出す移動は禁止
    if (newIndex < 0 || newIndex >= travelPartyLimit || newIndex >= state.player.length || index >= travelPartyLimit) {
        return;
    }

    // 配列の要素を入れ替える
    let temp = state.player[index];
    state.player[index] = state.player[newIndex];
    state.player[newIndex] = temp;

    updateStorageUI();
};
window.moveToReserve = function (idx) {
    if (state.player.length <= 1) {
        alert("パーティを0人にはできません！");
        return;
    }
    // 🌟 修正：選択したキャラを配列から切り取り、配列の一番最後（倉庫の底）にプッシュする
    let target = state.player.splice(idx, 1)[0];
    state.player.push(target);
    updateStorageUI();
};

window.moveToParty = function (idx, maxParty) {
    // 🌟 修正：選んだキャラを切り取り、指定された枠（一軍なら3番目、同行なら8番目）の手前に挿入する
    let target = state.player.splice(idx, 1)[0];
    let insertPos = Math.min(state.player.length, maxParty - 1);
    state.player.splice(insertPos, 0, target);
    updateStorageUI();
};
window.finishStorage = function () { state.currentStepIndex++; saveGame(); nextStory(); };
// ==========================================
// 配合所（レシピ型・モンスター合成）機能
// ==========================================
window.openFusion = function () {
    changeView("view-fusion");
    let opts = `<option value="-1">選択してください</option>`;
    state.player.forEach((p, i) => { opts += `<option value="${i}">${p.name} (Lv.${p.level})</option>`; });
    document.getElementById("fusion-base-sel").innerHTML = opts;
    document.getElementById("fusion-mat-sel").innerHTML = opts;
    document.getElementById("fusion-orb-count").innerText = state.orbShinsei || 0; // 🌟 宝珠の数を表示
    document.getElementById("btn-execute-fusion").disabled = true;
    document.getElementById("fusion-result-preview").innerText = "ベースと素材を選んでください";
};
window.updateFusionUI = function () {
    let baseIdx = parseInt(document.getElementById("fusion-base-sel").value);
    let matIdx = parseInt(document.getElementById("fusion-mat-sel").value);
    // 🌟 選択されているモードを取得
    let mode = document.querySelector('input[name="fusion_mode"]:checked').value;

    if (baseIdx === -1 || matIdx === -1) {
        document.getElementById("fusion-result-preview").innerText = "ベースと素材を選んでください";
        document.getElementById("btn-execute-fusion").disabled = true; return;
    }
    if (baseIdx === matIdx) {
        document.getElementById("fusion-result-preview").innerHTML = `<span style="color:#e53e3e;">⚠️ 同じキャラは選べません！</span>`;
        document.getElementById("btn-execute-fusion").disabled = true; return;
    }

    let base = state.player[baseIdx];
    let mat = state.player[matIdx];
    let bId = base.originalId || base.id.split('_')[0];
    let mId = mat.originalId || mat.id.split('_')[0];

    // 【モード：新生配合】
    if (mode === "shinsei") {
        if ((state.orbShinsei || 0) < 1) {
            document.getElementById("fusion-result-preview").innerHTML = `<span style="color:#e53e3e; font-weight:bold;">新生の宝珠が足りません！ (必要: 1)</span>`;
            document.getElementById("btn-execute-fusion").disabled = true;
            return;
        }
        let traitName = typeof TRAITS !== 'undefined' && TRAITS[mat.trait] ? TRAITS[mat.trait].name : "なし";
        document.getElementById("fusion-result-preview").innerHTML = `
            <span style="color:#805ad5; font-size:16px;">🔮 新生配合 🔮</span><br>
            ${base.name} の種族はそのままに、<br>
            特性が <span style="color:#e53e3e; font-weight:bold;">【${traitName}】</span> に書き換わります！<br>
            <span style="font-size:11px; color:#718096;">※ 宝珠を1つ消費し、親の技・SPを引き継ぎます。</span>`;
        document.getElementById("btn-execute-fusion").disabled = false;
        state.fusionResultType = "shinsei";
        return;
    }
// 【モード：通常/進化】
    if (bId === mId && base.id !== mat.id) {

        // 🌟 追加：エディタで進化配合が禁止されている場合はここで弾く
        if (state.enableEvolution === false || state.enableEvolution === "false") {
            document.getElementById("fusion-result-preview").innerHTML = `<span style="color:#e53e3e; font-weight:bold;">この世界では、同種同士の配合（進化）は禁止されている！</span>`;
            document.getElementById("btn-execute-fusion").disabled = true;
            return;
        }

        // 🌟 進化配合（同種 ＋ 別個体）
        document.getElementById("fusion-result-preview").innerHTML = `
            <span style="color:#38a169; font-size:16px;">🧬 進化配合 🧬</span><br>
            同種の力が共鳴し、${base.name} の<br>
            <span style="color:#e53e3e; font-weight:bold;">いずれか1つの属性耐性が 1段階 強化</span> されます！<br>
            <span style="font-size:11px; color:#718096;">※ 種族はそのまま。親の技・SPを引き継ぎます。</span>`;
        document.getElementById("btn-execute-fusion").disabled = false;
        state.fusionResultType = "evolution";
        return;
    }

    // 🌟 通常配合（レシピ検索）
    let allMasterData = [];
    if (window.customPlayerTeam) allMasterData = allMasterData.concat(window.customPlayerTeam);
    else if (typeof INITIAL_PLAYER_TEAM !== 'undefined') allMasterData = allMasterData.concat(INITIAL_PLAYER_TEAM);
    if (typeof ENEMY_MASTER !== 'undefined') allMasterData = allMasterData.concat(Object.values(ENEMY_MASTER));

    let resultMaster = allMasterData.find(p =>
        (p.recipe_parent1 === bId && p.recipe_parent2 === mId) ||
        (p.recipe_parent1 === mId && p.recipe_parent2 === bId)
    );

    if (!resultMaster) {
        document.getElementById("fusion-result-preview").innerHTML = `<span style="color:#e53e3e; font-weight:bold;">この組み合わせの配合レシピは存在しません。</span><br><span style="font-size:11px; color:#718096;">（同種同士なら進化配合、宝珠を使えば新生配合が可能です）</span>`;
        document.getElementById("btn-execute-fusion").disabled = true;
        return;
    }

    document.getElementById("fusion-result-preview").innerHTML = `
        <span style="color:#3182ce; font-size:16px;">✨ 通常配合 ✨</span><br>
        新たな種族 <span style="color:#2b6cb0; font-weight:bold; font-size:16px;">『${resultMaster.name}』</span> が生まれます！<br>
        <span style="font-size:11px; color:#718096;">※ ${base.name} と ${mat.name} の技・SPを引き継ぎます。</span>`;
    document.getElementById("btn-execute-fusion").disabled = false;
    state.fusionResultType = "normal";
    state.fusionResultMaster = resultMaster;
};
window.executeFusion = function () {
    let baseIdx = parseInt(document.getElementById("fusion-base-sel").value);
    let matIdx = parseInt(document.getElementById("fusion-mat-sel").value);
    let base = state.player[baseIdx];
    let mat = state.player[matIdx];
    let fType = state.fusionResultType;

    if (!confirm(`${base.name} と ${mat.name} を配合しますか？\n（※ 選んだ2体は消滅し、元には戻りません！）`)) return;

    let newChar;

    if (fType === "normal") {
        // 通常配合（マスターデータから生成）
        let rMaster = state.fusionResultMaster;
        newChar = JSON.parse(JSON.stringify(rMaster));
        newChar.originalId = rMaster.id;
    } else {
        // 進化・新生（ベースの種族を引き継ぐ）
        newChar = JSON.parse(JSON.stringify(base));

        if (fType === "shinsei") {
            // 新生配合：宝珠消費 ＆ 特性上書き
            state.orbShinsei--;
            newChar.trait = mat.trait;
        } else if (fType === "evolution") {
            // 進化配合：耐性ランダム強化
            const ATTRS = ["fire", "elec", "ice", "wind", "water", "earth", "bomb", "dark", "wave", "light", "mystic", "spirit", "gravity", "fight", "grass"];
            // 🌟 修正：ランクに "ab" (吸収) を追加し、暴落バグを防ぐ！
            const RANKS = ["wk", "nm", "hl", "rs", "nu", "rp", "ab"];

            // 🌟 修正：反射(rp)と吸収(ab)になっていない属性だけを抽出
            let upgradable = ATTRS.filter(attr => {
                let aff = newChar[`aff_${attr}`] || "nm";
                return aff !== "rp" && aff !== "ab"; 
            });

            if (upgradable.length > 0) {
                let targetAttr = upgradable[Math.floor(Math.random() * upgradable.length)];
                let currentRank = newChar[`aff_${targetAttr}`] || "nm";
                // 🌟 修正：限界突破しないようにガード
                let nextRank = RANKS[RANKS.indexOf(currentRank) + 1] || "ab";
                newChar[`aff_${targetAttr}`] = nextRank;
                alert(`🧬 進化の力が発現！\n${newChar.name} の【${ATTR_NAMES[ATTRS.indexOf(targetAttr)]}耐性】が 1段階 アップした！`);
            } else {
                alert(`🧬 これ以上進化できない完全体だ！\n（※すべての属性が反射・吸収に到達しています）`);
            }
        }
    }

    // 🌟 共通処理：ID再発行、レベル1リセット
    const uniqueHex = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    newChar.id = newChar.originalId + "_" + Date.now() + "_" + uniqueHex;
    if (typeof window.hydrateData === 'function') {
        let hydrated = window.hydrateData({ player: [newChar] });
        Object.assign(newChar, hydrated.player[0]);
    }
    newChar.level = 1; newChar.levelExp = 0; newChar.hp = newChar.maxHp;
    newChar.equip = null; newChar.equips = []; newChar.status = "none"; newChar.statusTurn = 0;
    if (typeof initResistance === "function") initResistance(newChar, true);

    // 🌟 SPの継承計算（属性攻撃力を含むすべての消費SPを合算して半分にする）
    const calcTotalSp = (p) => {
        let used = 0;
        if (p.growStats) {
            for (let key in p.growStats) {
                const menuDef = typeof GROW_MENU !== 'undefined' ? GROW_MENU.find(m => m.key === key) : null;
                if (menuDef) used += (p.growStats[key] * menuDef.cost);
            }
        }
        return (p.sp || 0) + used;
    };
    let baseTotalSp = calcTotalSp(base);
    let matTotalSp = calcTotalSp(mat);
    newChar.sp = Math.floor((baseTotalSp + matTotalSp) / 2);
    newChar.growStats = {}; // 育成記録はリセット

    // 🌟 技の継承（親2体の技を統合し、maxSkillsに収める）
    let newSkills = new Set(newChar.skills || []);
    if (base.skills) base.skills.forEach(s => newSkills.add(s));
    if (mat.skills) mat.skills.forEach(s => newSkills.add(s));
    let skillArray = Array.from(newSkills);
    if (state.maxSkills > 0 && skillArray.length > state.maxSkills) skillArray = skillArray.slice(0, state.maxSkills);
    newChar.skills = skillArray;

     [base, mat].forEach(p => {
        let eqList = Array.isArray(p.equips) ? p.equips : (p.equip ? [p.equip] : []);
        eqList.forEach(eid => { 
            if (eid && eid !== "none") state.ownedEquips.push(eid); 
        });
        p.equips = []; p.equip = null;
    });


    // 🌟 親の削除と子供の追加
     let idxs = [baseIdx, matIdx].sort((a, b) => b - a);
    state.player.splice(idxs[0], 1);
    state.player.splice(idxs[1], 1);
    
    // 🌟 追加：生まれたての子の、戦闘用見えないフラグを綺麗に掃除してあげる
    if (typeof cleanUpCharacterBattleFlags === 'function') cleanUpCharacterBattleFlags(newChar);

    state.player.push(newChar);

    // 🌟 プレイヤーへの親切な説明（初期SPの表示）
    alert(`🎉 配合成功！\n『${newChar.name}』が誕生し、親から ${newChar.sp} SPと技を受け継ぎました！\n（※預かり所に送られました）`);
    openFusion();
};

window.finishFusion = function () { state.currentStepIndex++; saveGame(); nextStory(); };
// ==========================================
// リザルト（戦闘結果・スカウト命名）機能
// ==========================================
window.openResultScreen = async function (money, exp, droppedItems = []) {
    changeView("view-result");
    
    state.isAnimating = false;
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('is-processing');
    document.getElementById("res-money").innerText = money;
    document.getElementById("res-exp").innerText = exp;

    let dropHtml = "";
    if (droppedItems && droppedItems.length > 0) {
        dropHtml = `<div style="background:#ebf8ff; padding:10px; border:2px solid #3182ce; border-radius:8px; margin-top:15px;">
            <h3 style="color:#2b6cb0; font-size:16px; margin-bottom:8px; border-bottom:1px solid #90cdf4; padding-bottom:4px;">🎁 獲得アイテム</h3>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">`;
        
        for (const item of droppedItems) {
            let aaText = "？"; 
            if (item.aa) {
                let decoded = window.decodeAA(item.aa);
                // 🌟 修正：パス指定（ドット区切り）なら、resolveAA で本物を取りに行く！
                if (decoded.includes('.') && !decoded.includes('\n')) {
                    aaText = await resolveAA(decoded).catch(() => "🎁");
                } else {
                    aaText = decoded;
                }
            }
            dropHtml += `<div style="display:flex; align-items:center; gap:5px; background:#fff; padding:4px 8px; border-radius:4px; border:1px solid #cbd5e0;">
                <pre style="font-size:8px; margin:0; line-height:1; font-family:'aahub';">${aaText}</pre>
                <span style="font-size:12px; font-weight:bold; color:#2d3748;">${item.name}</span>
            </div>`;
        }
        dropHtml += `</div></div>`;
    }
    let membersHtml = state.player.map((p, i) => {
        if (i >= (state.battleMemberCount || 3)) return ""; // 控えは表示しない

        // 育成ボタン（SPがあれば光る）
        const sp = p.sp || 0;
        const growBtnStyle = sp > 0 ? "background: var(--warning); border-color: var(--warning-dark); color: #000; animation: blink 2s infinite;" : "";
        const growBtnText = sp > 0 ? `★育成 (SP:${sp})` : `育成 (SP:0)`;

        const pStats = getStats(p, true);
        const traitName = typeof TRAITS !== 'undefined' && TRAITS[p.trait] ? TRAITS[p.trait].name : "なし";

        return `
        <div class="prep-char-card" style="margin-bottom:10px;">
            <div style="flex:1">
                <div style="margin-bottom:4px; font-size:16px;">
                    <b>${p.name}</b> <span class="lv">Lv.${p.level}</span>
                </div>
                <div style="font-size:12px; margin-bottom:6px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <span style="color:#e53e3e; font-weight:bold;">HP:${p.hp}/${p.maxHp}</span>
                    <span style="color:#2b6cb0; font-weight:bold;">技:${pStats.tech}</span>
                    <span style="color:#38a169; font-weight:bold;">経:${pStats.exp}</span>
                    <span style="background:#edf2f7; color:#553c9a; padding:1px 6px; border-radius:4px; font-size:10px; border:1px solid #d6bcfa;">
                        特性: ${traitName}
                    </span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; margin-left:10px; justify-content:center;">
                <button class="cmd-btn" style="${growBtnStyle}; padding:10px;" onclick="openGrowModal(${i})">${growBtnText}</button>
            </div>
        </div>`;
    }).join("");

    // HTMLの「res-scout-area」の【手前】にねじ込むための新しいコンテナを作るか、既存要素を使う
    let resultMembersDiv = document.getElementById("res-members-area");
    if (!resultMembersDiv) {
        resultMembersDiv = document.createElement("div");
        resultMembersDiv.id = "res-members-area";
        // res-scout-area の直前に挿入
        const scoutArea = document.getElementById("res-scout-area");
        scoutArea.parentNode.insertBefore(resultMembersDiv, scoutArea);
    }
    resultMembersDiv.innerHTML = dropHtml + `<h3 style="border-left:4px solid var(--primary); padding-left:8px; margin-bottom:10px; font-size:15px; margin-top:15px;">成長の確認</h3>` + membersHtml;

    // (以下、既存のスカウトキャラのUI構築などを続ける)
    let scouted = state.battleFlags.scoutedList || [];
    const scoutArea = document.getElementById("res-scout-area");
    const scoutList = document.getElementById("res-scout-list");

    if (scouted.length > 0) {
        scoutArea.style.display = "block";
        let html = "";
        scouted.forEach((c, idx) => {
            html += `<div class="prep-char-card" style="margin-bottom:10px; border-color:#38a169;">
                <div class="p-aa" style="margin-right:10px;"><pre style="font-size:10px;">${c.aa && !c.aa.includes(".") ? c.aa : "(顔画像)"}</pre></div>
                <div style="flex:1;">
                    <div style="font-size:11px; color:#718096; margin-bottom:4px;">${c.name} が 仲間になった！</div>
                    <input type="text" id="scout-name-${idx}" value="${c.name}" class="w-100" style="padding:5px; font-weight:bold; color:#2b6cb0;" placeholder="名前を入力">
                </div>
            </div>`;
        });
        scoutList.innerHTML = html;
    } else {
        scoutArea.style.display = "none";
        scoutList.innerHTML = "";
    }
};

window.finishResult = function () {
    state.isAnimating = false;
    isSkipping = false;
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('is-processing');
    let scouted = state.battleFlags.scoutedList ||[];
    let overflowCount = 0;

    // 🌟 追加：危険な文字を安全な全角文字に変換するサニタイズ関数
    const sanitizeHTML = (str) => {
        if (!str) return "";
        return str.replace(/&/g, '＆').replace(/</g, '＜').replace(/>/g, '＞').replace(/"/g, '”').replace(/'/g, '’');
    };

    scouted.forEach((c, idx) => {
        let inputName = document.getElementById(`scout-name-${idx}`).value.trim();
        
        if (inputName) {
            c.name = sanitizeHTML(inputName);
        }

        let baseId = c.originalId || c.id.split('_')[0];
        c.originalId = baseId;
        const uniqueHex = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0'); 
        c.id = `${baseId}_${Date.now()}_${uniqueHex}`;

        // 🌟 追加：敵としてのAIデータやドロップ品の「汚れ」を味方データから消し去る
        delete c.dropMoney;
        delete c.dropExp;
        delete c.isBoss;
        delete c.ai_move_type;
        delete c.ai_move_pinch;
        delete c.ai_cards;
        delete c.act_base_skill;
        delete c.act_base_skill2;
        delete c.trigger_id;
        delete c.trigger_scene;
        delete c.death_scene;
if (typeof window.hydrateData === 'function') {
            let tempTeam = { player: [c] };
            let hydrated = window.hydrateData(tempTeam);
            Object.assign(c, hydrated.player[0]);
        }

        if (state.player.length < state.maxPlayerCount) {
            state.player.push(c);
            if (state.player.length > 8) {
                alert(`${c.name} は同行枠がいっぱいのため、預かり所に送られました。`);
            } else {
                alert(`${c.name} が同行メンバーに加わりました！`);
            }
        } else {
            overflowCount++;
        }
    });

    if (overflowCount > 0) {
        alert(`預かり所がいっぱいで、${overflowCount}体のモンスターは逃がしました……。`);
    }

    state.battleFlags.scoutedList = []; // リストを空にする

    state.player.forEach(p => {
        if (p.hp > 0) {
            p.rechargeTurn = 0;
            p.chargeSkillId = null;
            p.hasDoubleStrike = false;
            p.hasBursted = false;
            p.hasBeenCountered = false;
            p.isFirstTurn = true;
            p.turnInBattle = 0;
            p.guaranteeHit = false;
            
            // 🌟追加：戦いの記憶を完全にリセット
            p.critCount = 0;
            p.hitCombo = 0;
            p.lastUsedSkill = null;
            p.skillUseCount = 0;
            p.transformCrit = false;
            p.guaranteeDodge = false;
            p.counterActive = false;
            p.statBuff = 0;
            p.resUpShock = false;
            p.resUpHeat = false;
            p.resUpElec = false;
        }
    });

    // 死亡ロスト（人生縛り）の処理
    if (state.enablePermaDeath) {
        let deadNames = [];
        for (let i = state.player.length - 1; i >= 0; i--) {
            if (state.player[i].hp <= 0) {
                deadNames.push(state.player[i].name);
                // 装備を持っていれば外して所持品に戻す（ロストさせない親切設計）
                if (state.player[i].equip) {
                    state.ownedEquips.push(state.player[i].equip);
                }
                state.player.splice(i, 1); // 配列から完全に削除
            }
        }

        // 死亡者がいた場合、悲痛なメッセージを表示する
        if (deadNames.length > 0) {
            alert(`【悲報】 死亡した ${deadNames.join("、")} は、もう二度と戻らない……。`);
        }

        if (state.player.length === 0) {
            state.player.push({ id: "dead_body", name: "死体", hp: 0, maxHp: 1, tech: 0, exp: 0, baseDmg: 0, baseDef: 0 });
        }
    }

    // 🌟 修正2：次の戦いに影響が出ないよう、パーティーバトルの記憶を完全に消去する！
    state.partyBattle = null;

    // ▼▼▼ ここに必ずこの2行を追加してください！ ▼▼▼
    state.inBattle = false;
    state.isPrepPhase = false;
    // ▲▲▲ 追加ここまで ▲▲▲

    saveGame();

    if (state.battleScoutSuccess && state.battleScoutNext) {
        let next = state.battleScoutNext;
        state.battleScoutNext = null;
        state.battleScoutSuccess = false;
        jumpTo(next);
    } else if (state.battleWinNext) {
        let next = state.battleWinNext;
        state.battleWinNext = null;
        jumpTo(next);
    } else {
        state.inBattle = false; // 🌟 念のため折る
        state.currentStepIndex++; // 🌟 追加：ジャンプ先がない場合はここでインデックスを進める
        nextStory();
    }
};

// ==========================================
// 冒険の書（進行状況・セーブデータ）の画像エクスポート
// ==========================================
window.exportSaveImageData = async function () {
    const saveData = await getGameStateForSave(); // 🌟 共通関数を呼ぶ

    const packedData = JSON.stringify(saveData);
    const compressed = await compressToBinary(packedData);

    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(0,0,0,0.9)"; 
    ctx.fillRect(0, 0, 400, 400);
    ctx.strokeStyle = "#ecc94b"; ctx.lineWidth = 6; 
    ctx.strokeRect(5, 5, 390, 390);

    ctx.save();
    ctx.beginPath();
    ctx.rect(5, 5, 390, 390);
    ctx.clip(); 

    ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("あんこクエスト 冒険の書", 200, 45);
    
    ctx.fillStyle = "#ecc94b"; ctx.font = "bold 18px sans-serif";
    ctx.fillText(`プロジェクト: ${saveData.PROJECT_TITLE}`, 200, 85, 360);
    
    ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif";
    ctx.fillText(`所持金: ${state.money} G / 珠: ${state.orbShinsei || 0}`, 200, 125);
    ctx.fillText(`仲間: ${state.player.length} 人 / LV: ${state.player[0] ? state.player[0].level : 1}`, 200, 155);

    for (let i = 0; i < 3; i++) {
        if (state.player[i]) {
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.fillRect(25 + i * 125, 185, 100, 100);
            
            ctx.fillStyle = "#a0aec0"; ctx.font = "10px monospace";
            const face = await getFace(state.player[i]);
            const lines = face.split('\n').slice(0, 8);
            lines.forEach((l, idx) => ctx.fillText(l, 75 + i * 125, 205 + idx * 11, 90));
            
            ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif";
            ctx.fillText(state.player[i].name, 75 + i * 125, 305, 90);
        }
    }

    ctx.fillStyle = "#718096"; ctx.font = "bold 12px sans-serif";
    ctx.fillText("この画像をドロップして冒険を再開！", 200, 365);
    ctx.restore();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    const arrayBuffer = await blob.arrayBuffer();
    const finalPng = appendMultiDataToPNG(arrayBuffer, { type: "SAVE_DATA", pid: saveData.PROJECT_TITLE }, compressed);

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([finalPng]));
    
    const safeTitle = saveData.PROJECT_TITLE.replace(/[\\/:*?"<>|]/g, "_").substring(0, 30);
    a.download = `SAVE_${safeTitle}_Day${state.day}.png`;
    a.click();
    
    if (typeof showToast === 'function') showToast("🖼️ 冒険の書を書き出したお！", "success");
    if (typeof closeSystemMenu === 'function') closeSystemMenu();
};

// ==========================================
// 進行データ（セーブデータ）の外部ファイル入出力
// ==========================================
window.exportSaveDataToFile = async function () {
    if (state.isTestPlay) {
        alert("テストプレイ中はセーブデータを出力できません。");
        return;
    }
    if (state.isAnimating) {
        alert("演出中やバトル中はセーブできません。\n安全な場面（会話中やマップなど）でお試しください。");
        return;
    }

    try {
        let defaultName = state.PROJECT_TITLE ? `${state.PROJECT_TITLE}_` : "anko_save_";
        defaultName += `Day${state.day}`;
        let inputName = prompt("保存するセーブデータの名前を入力してください", defaultName);

        if (inputName === null) return; 
        inputName = inputName.trim().replace(/[\\/:*?"<>|]/g, "_") || "save_data"; 

        const saveData = await getGameStateForSave(); // 🌟 共通関数を呼ぶ

        const jsonStr = JSON.stringify(saveData);
        const compressedBinary = await compressToBinary(jsonStr);

        const blob = new Blob([compressedBinary], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        a.download = `${inputName}.sav`; 
        a.click();
        URL.revokeObjectURL(url);

        alert("📤 セーブデータを出力しました！\n（拡張子 .sav のファイルがダウンロードされます）");
        closeSystemMenu();
    } catch (e) {
        console.error(e);
        alert("❌ セーブデータの出力に失敗しました。");
    }
};
window.importSaveDataFromFile = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const jsonStr = await decompressFromBinary(uint8Array);
        const loadedData = JSON.parse(jsonStr);

        const currentHash = await calculateGameHash();
        if (loadedData.HASH !== currentHash) {
            const proceed = confirm(`⚠️ 警告: このセーブデータは、現在読み込んでいるゲームと異なります！\n\n【セーブの記録】: ${loadedData.PROJECT_TITLE}\n\n無理に読み込むと進行不能になる可能性があります。それでも強行しますか？`);
            if (!proceed) { event.target.value = ""; return; }
        }

        // 🌟 共通関数を呼んでデータを復元！
        await applySaveData(loadedData);

        await saveGame();
        alert(`📥 セーブデータの復元に成功したお！\n【${loadedData.PROJECT_TITLE}】の続きから再開します。`);

        closeSystemMenu();

        const scene = SCENARIO[state.currentSceneId];
        if (scene) {
            if (state.currentStepIndex >= scene.length) {
                state.currentStepIndex = Math.max(0, scene.length - 1);
            }
            const currentStep = scene[state.currentStepIndex];
            if (currentStep && currentStep.type === "map") {
                startMapMode(currentStep);
            } else if (state.tacData) {
                changeView("view-tactical");
                updateTacticalUI();
            } else {
                changeView("view-story");
                document.getElementById("story-choices").style.display = "none";
                document.getElementById("story-dice-area").style.display = "none";
                document.getElementById("story-message-box").style.display = "block";
                nextStory();
            }
        } else {
            alert("エラー：保存されたシーンが見つかりません。タイトルに戻ります。");
            returnToTitle();
        }

    } catch (err) {
        console.error(err);
        alert("❌ ファイルの解析に失敗しました。有効なセーブデータ（.sav）ではありません。");
    }
    event.target.value = "";
};
// ==========================================
// 装備品の性能テキスト自動生成
// ==========================================
function getEquipStatText(item) {
    if (!item || item.type !== "equip") return "";
    let stats = [];

    // プラスなら「+」、マイナスならそのまま表示する
    const format = (val) => val > 0 ? `+${val}` : val;

    if (item.addTech) stats.push(`技${format(item.addTech)}`);
    if (item.addExp) stats.push(`経${format(item.addExp)}`);
    if (item.addDmg) stats.push(`攻${format(item.addDmg)}`);
    if (item.addDef) stats.push(`防${format(item.addDef)}`);
    if (item.atkShock) stats.push(`衝攻${format(item.atkShock)}`);
    if (item.atkHeat) stats.push(`熱攻${format(item.atkHeat)}`);
    if (item.atkElec) stats.push(`電攻${format(item.atkElec)}`);
    if (item.addMaxShock) stats.push(`衝耐${format(item.addMaxShock)}`);
    if (item.addMaxHeat) stats.push(`熱耐${format(item.addMaxHeat)}`);
    if (item.addMaxElec) stats.push(`電耐${format(item.addMaxElec)}`);

    if (stats.length === 0) return "";
    return `<span style="color:#2b6cb0; font-size:10px; font-weight:bold;">[${stats.join(" ")}]</span>`;
}

// ==========================================
// PvP：思考制限タイマー管理
// ==========================================
let pvpTimerInterval = null;
let pvpTimeRemaining = 0;

function startPvPTimer() {
    if (!state.isPvP || state.pvpTimeLimit <= 0) return;

    clearInterval(pvpTimerInterval);
    pvpTimeRemaining = state.pvpTimeLimit;

    const display = document.getElementById("pvp-timer-display");
    const valSpan = document.getElementById("pvp-timer-val");
    display.style.display = "block";
    valSpan.innerText = pvpTimeRemaining;

    pvpTimerInterval = setInterval(() => {
        pvpTimeRemaining--;
        valSpan.innerText = pvpTimeRemaining;

        if (pvpTimeRemaining <= 10) {
            display.style.background = "rgba(229,62,62,1)"; // 残り10秒で赤く強調
            display.style.transform = "scale(1.1)";
        }

        if (pvpTimeRemaining <= 0) {
            clearInterval(pvpTimerInterval);
            autoSubmitPvPCommands(); // 時間切れ：自動送信
        }
    }, 1000);
}
function stopPvPTimer() {
    clearInterval(pvpTimerInterval);
    const display = document.getElementById("pvp-timer-display");
    if (display)display.style.display = "none";
}
function autoSubmitPvPCommands() {
    if (!state.isPvP || !state.partyBattle || state.partyBattle.phase !== 'command') return;

    // 現在入力待ちのキャラから、最大3人目までを「様子を見る」で埋める
    while (state.partyBattle.currentActorIdx < 3 && state.partyBattle.currentActorIdx < state.player.length) {
        let actor = state.player[state.partyBattle.currentActorIdx];
        if (actor && actor.hp > 0) {
            state.partyBattle.actions.push({
                isPlayer: true,
                actorIdx: state.partyBattle.currentActorIdx,
                action: "attack",
                param: "nothing",
                targetIdx: -1
            });
        }
        state.partyBattle.currentActorIdx++;
    }

    // 全員のコマンドが埋まった状態にして送信へ
    onPvPCommandsReady();
}
// ==========================================
// 制限時間タイマー ＆ TOD（判定決着）ロジック
// ==========================================
let turnTimerInterval = null;
let timeRemaining = 0;

window.startTurnTimer = function () {
    document.getElementById("battle-info-display").style.display = "block";
    document.getElementById("turn-val").innerText = state.turnCount;

    // 🌟修正：タイマー設定がない場合(undefined)に NaN になるのを防ぐため、確実に数値化する
    let tLimit = Number(state.timeLimit) || 0;
    if (tLimit <= 0 || state.isPvP) return;

    clearInterval(turnTimerInterval);
    timeRemaining = tLimit;
    const timerDisplay = document.getElementById("timer-display");
    const valSpan = document.getElementById("timer-val");
    timerDisplay.style.display = "inline-block";
    timerDisplay.style.background = "rgba(45,55,72,0.9)";
    timerDisplay.style.transform = "scale(1)";
    valSpan.innerText = timeRemaining;

    turnTimerInterval = setInterval(() => {
        timeRemaining--;
        valSpan.innerText = timeRemaining;
        if (timeRemaining <= 5) {
            timerDisplay.style.background = "rgba(229,62,62,1)";
            timerDisplay.style.transform = "scale(1.1)";
        }
        if (timeRemaining <= 0) {
            stopTurnTimer();
            forceTimeOverAction();
        }
    }, 1000);
};

window.stopTurnTimer = function () {
    clearInterval(turnTimerInterval);
    const timerDisplay = document.getElementById("timer-display");
    if (timerDisplay) timerDisplay.style.display = "none";
};

async function forceTimeOverAction() {
    await showMsg(`【TIME OVER】<br>時間切れだお！ 強制的に「様子を見る」になるお！`);
    setTimeout(() => {
        if (state.enablePartyBattle && state.partyBattle && state.partyBattle.phase === 'command') {
            while (state.partyBattle.currentActorIdx < 3 && state.partyBattle.currentActorIdx < state.player.length) {
                let actor = state.player[state.partyBattle.currentActorIdx];
                if (actor && actor.hp > 0) {
                    state.partyBattle.actions.push({ isPlayer: true, actorIdx: state.partyBattle.currentActorIdx, action: "attack", param: "nothing", targetIdx: -1 });
                }
                state.partyBattle.currentActorIdx++;
            }
            if (state.isPvP) onPvPCommandsReady(); else startPartyTurn();
        } else {
            executeAction("attack", "nothing"); // 1vs1の場合
        }
    }, 1500);
}

// TOD（判定）処理：生存数 ➔ HP割合 ➔ HP実数値で勝敗を決める
window.checkTOD = async function () {
    if (state.turnLimit <= 0 || state.turnCount <= state.turnLimit) return false;

    await showMsg(`【TIME UP】<br>規定ターン（${state.turnLimit}ターン）に到達！判定を行うお！`);
    await wait(2000);

    const calcScore = (team) => {
        let alive = 0, hpPer = 0, hpSum = 0;
        team.forEach(c => { if (c.hp > 0) { alive++; hpPer += (c.hp / c.maxHp); hpSum += c.hp; } });
        return { alive, hpPer, hpSum };
    };
    const pScore = calcScore(state.player); const eScore = calcScore(state.enemy);

    let isPlayerWin = false, isDraw = false;
    if (pScore.alive !== eScore.alive) { isPlayerWin = pScore.alive > eScore.alive; }
    else if (Math.abs(pScore.hpPer - eScore.hpPer) > 0.01) { isPlayerWin = pScore.hpPer > eScore.hpPer; }
    else if (pScore.hpSum !== eScore.hpSum) { isPlayerWin = pScore.hpSum > eScore.hpSum; }
    else { isDraw = true; }

    if (state.isPvP) {
        if (isDraw) await showMsg(`【引き分け】 おたがいの スコアが 完全に一致したお！`);
        else if (isPlayerWin) await showMsg(`<span style="color:#38a169;">【判定勝利！！】</span> スコアで 相手を上回ったお！`);
        else await showMsg(`<span style="color:#e53e3e;">【判定敗北...】</span> スコアで 相手に下回ったお...`);
        await wait(4000); endPvP(); return true;
    } else {
        if (isPlayerWin || isDraw) {
            await showMsg(`<span style="color:#38a169;">【判定勝利！！】</span> 優勢勝ちだお！`);
            await wait(2000);
            let tMoney = 0, tExp = 0;
            state.enemy.forEach(e => { tMoney += (e.dropMoney || 0); tExp += (e.dropExp || 0); });
            state.money = Math.min(99999999, state.money + tMoney);
            openResultScreen(state.enablePartyBattle ? tMoney : (state.battleFlags.earnedMoney + tMoney), state.enablePartyBattle ? tExp : (state.battleFlags.earnedExp + tExp));
            return true;
        } else {
            await showMsg(`<span style="color:#e53e3e;">【判定敗北...】</span> 押し切れなかったお...`);
            await wait(2000);
            if (state.battleLoseNext) jumpTo(state.battleLoseNext);
            else { await showMsg(`めのまえが まっくらになった……`);
            setTimeout(async () => { 
                if (state.isTestPlay) { 
                    alert("テスト終了（全滅）"); state.isTestPlay = false; changeView("view-editor"); 
                } else { 
                    // 🌟 セーブを消さずにタイトルへ戻す
                    alert("パーティが全滅しました……。\nタイトル画面に戻ります。最後にセーブした場所からやり直してください。");
                    cleanupGameState();
                    changeView("view-title"); 
                } 
            }, 3000);
 }
            return true;
        }
    }
};

window.stripAllReserveEquip = function () {
    if (!confirm("控えメンバーの装備をすべて回収しますか？")) return;

    let stripped = false;
    let memberLimit = state.battleMemberCount || 3;
    for (let i = memberLimit; i < state.player.length; i++) {
        let p = state.player[i];
        if (Array.isArray(p.equips) && p.equips.some(e => e !== null)) {
            // 🌟 修正：外した装備を在庫（ownedEquips）にしっかり戻す！
            p.equips.forEach(eid => {
                if (eid && eid !== "none") state.ownedEquips.push(eid);
            });
            p.equips = []; // 🌟全スロット解除
            p.equip = null; // 念のため古いデータも消去
            stripped = true;
        }
    }

    if (stripped) {
        alert("控えメンバーの装備をすべて外しました！");
        updateStorageUI();
    } else {
        alert("回収できる装備がありませんでした。");
    }
};

// ==========================================
// 敵撃破時のカットイン演出
// ==========================================
window.showCutin = async function (actor) {
    const cutin = document.getElementById("battle-cutin");
    if (!cutin) return;

    document.getElementById("cutin-aa").innerText = await getFace(actor);
    document.getElementById("cutin-name").innerText = actor.name;
    const msgs = ["TARGET DESTROYED!", "撃 破 !!", "FATAL BLOW!!", "討 伐 完 了 !!", "FINISH!!"];
    document.getElementById("cutin-msg").innerText = msgs[Math.floor(uiRandom() * msgs.length)];

    cutin.style.transition = "none";
    cutin.style.left = "-100%";
    cutin.style.display = "flex";

    cutin.offsetWidth; // リフロー（ブラウザに認識させる）
if (typeof fitAAToContainer === "function") {
        fitAAToContainer(document.getElementById("cutin-aa"), cutin);
    }
    cutin.style.transition = "left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    cutin.style.left = "0px";

    document.getElementById("view-battle").classList.add("shake");
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // 🌟 演出中は絶対にスキップさせないシールドを展開
    let tempSkip = isSkipping;
    isSkipping = false;

    await wait(1200); // キメポーズ

    document.getElementById("view-battle").classList.remove("shake");
    cutin.style.left = "100%";
    await wait(800);
    cutin.style.display = "none";

    // 🌟 シールド解除
    isSkipping = tempSkip;
};

// ==========================================
// 📊 ステータス＆フラグ確認（デバッグ機能兼用）
// ==========================================
window.openFlagStatusModal = async function () {
    const modal = document.getElementById("flag-status-modal");
    const content = document.getElementById("flag-status-content");

    let html = "";

    // 1. グローバルフラグ（周回データ）
    const gf = await loadFromIndexedDB(STORE_GLOBAL, 'flags') || {};
    html += `<div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e0;">
        <h4 style="color:#805ad5; margin-bottom:5px; border-bottom:1px solid #e9d8fd;">🌐 グローバルフラグ (G_〜)</h4>`;
    if (Object.keys(gf).length === 0) html += `<div style="color:#a0aec0;">設定されていません</div>`;
    for (let k in gf) html += `<div><span style="font-family:monospace; font-weight:bold;">${k}</span> : <span style="color:#e53e3e; font-weight:bold;">${gf[k]}</span></div>`;
    html += `</div>`;

    // 2. 進行フラグ（現在のセーブデータ限定）
    html += `<div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e0;">
        <h4 style="color:#2b6cb0; margin-bottom:5px; border-bottom:1px solid #bee3f8;">🚩 進行フラグ (現在のデータ)</h4>`;
    if (Object.keys(state.flags).length === 0) html += `<div style="color:#a0aec0;">設定されていません</div>`;
    for (let k in state.flags) html += `<div><span style="font-family:monospace; font-weight:bold;">${k}</span> : <span style="color:#e53e3e; font-weight:bold;">${state.flags[k]}</span></div>`;
    html += `</div>`;

    // 3. キャラ個別の隠しパラメータ（好感度など）
    html += `<div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e0;">
        <h4 style="color:#38a169; margin-bottom:5px; border-bottom:1px solid #c6f6d5;">💖 キャラ個別パラメータ (好感度など)</h4>`;

    // システムの基本ステータスは除外し、エディタで後から追加した変数だけを抽出する
    const ignoreKeys = ["id", "originalId", "name", "aa", "recipe_parent1", "recipe_parent2", "level", "levelExp", "sp", "hp", "maxHp", "tech", "exp", "baseDmg", "baseDef", "maxShock", "maxHeat", "maxElec", "recShock", "recHeat", "recElec", "revShock", "revHeat", "revElec", "atkShock", "atkHeat", "atkElec", "trait", "skills", "equipSkills", "equip", "status", "statusTurn", "curShock", "curHeat", "curElec", "breakShock", "breakHeat", "breakElec", "isFirstTurn", "turnInBattle", "hasDoubleStrike", "critCount", "hitCombo"];

    state.player.forEach(p => {
        let customFlags = [];
        Object.keys(p).forEach(k => {
            if (!ignoreKeys.includes(k) && !k.startsWith("aff_")) {
                customFlags.push(`<span style="font-family:monospace;">${k}</span>: <span style="color:#e53e3e; font-weight:bold;">${p[k]}</span>`);
            }
        });

        if (customFlags.length > 0) {
            html += `<div style="margin-bottom:8px;">
                <div style="font-weight:bold; color:#2d3748;">👤 ${p.name}</div>
                <div style="padding-left:15px; border-left:2px solid #cbd5e0; font-size:12px;">${customFlags.join(" / ")}</div>
            </div>`;
        }
    });
    if (html.endsWith(`💖 キャラ個別パラメータ (好感度など)</h4>`)) html += `<div style="color:#a0aec0;">カスタム変数は設定されていません</div>`;
    html += `</div>`;

    content.innerHTML = html;
    modal.style.display = "flex";
    document.querySelector(".app-container").style.pointerEvents = "none";
    modal.style.pointerEvents = "auto";
};

window.closeFlagStatusModal = function () {
    document.getElementById("flag-status-modal").style.display = "none";
    const container = document.querySelector(".app-container");
    if (container) {
        container.style.pointerEvents = "auto";
        container.focus();
    }
};

// ==========================================
// 🎰 カジノ（ミニゲーム）システム
// ==========================================
let mgState = {
    step: null, playsLeft: 0, isPlaying: false,
    pokerDeck: [], pokerHand: [], pokerHeld: [false, false, false, false, false], pokerPhase: 0,
    rouletteBet: ""
};

window.openMinigame = function (step) {
    mgState.step = step;
    mgState.playsLeft = step.playLimit || 0;
    mgState.isPlaying = false;
    mgState.pokerPhase = 0;
    mgState.rouletteBet = "";

    document.getElementById("mg-title").innerText = step.gameType === "slot" ? "🎰 スロット" : step.gameType === "roulette" ? "🎡 ルーレット" : "🃏 ビデオポーカー";

    // ベット対象の表記
    let cType = "G";
    if (step.betType === "hp") cType = "HP";
    if (step.betType === "sp") cType = "SP";
    document.getElementById("mg-currency-type").innerText = cType;
    document.getElementById("btn-mg-play").innerText = `${step.betAmount}${cType} 賭けて遊ぶ`;

    updateMinigameUI();
    document.getElementById("mg-display").innerText = "READY?";
    document.getElementById("mg-msg").innerText = "いらっしゃいませ！";
    document.getElementById("mg-controls").innerHTML = "";

    if (step.gameType === "gauge" || step.gameType === "qte" || step.gameType === "mash" || step.gameType === "tetris") {
        openActionGame(step);
        return;
    }

    if (step.gameType === "roulette") {
        document.getElementById("mg-controls").innerHTML = `
            <button class="btn-info" style="flex:1;" onclick="setRouletteBet('odd')">奇数 に賭ける</button>
            <button class="btn-custom" style="flex:1;" onclick="setRouletteBet('even')">偶数 に賭ける</button>
        `;
        document.getElementById("btn-mg-play").disabled = true;
    }
    else if (step.gameType === "poker") {
        document.getElementById("mg-controls").innerHTML = `
            <div style="width:100%; background:#2d3748; padding:10px; border-radius:8px; border:2px solid #4a5568; font-size:11px; color:#e2e8f0; text-align:left; line-height:1.4;">
                <div style="color:#ecc94b; font-weight:bold; margin-bottom:5px; text-align:center;">📋 役と配当倍率</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                    <div>・ﾛｲﾔﾙｽﾄﾚｰﾄﾌﾗｯｼｭ: <span style="color:#f56565;">100倍</span></div>
                    <div>・ｽﾄﾚｰﾄﾌﾗｯｼｭ: <span style="color:#f56565;">50倍</span></div>
                    <div>・ﾌｫｰｶｰﾄﾞ(4枚同じ): <span style="color:#ecc94b;">20倍</span></div>
                    <div>・ﾌﾙﾊｳｽ(3枚+2枚): <span style="color:#ecc94b;">10倍</span></div>
                    <div>・ﾌﾗｯｼｭ(全同じﾏｰｸ): <span style="color:#48bb78;">7倍</span></div>
                    <div>・ｽﾄﾚｰﾄ(連番5枚): <span style="color:#48bb78;">5倍</span></div>
                    <div>・ｽﾘｰｶｰﾄﾞ(3枚同じ): <span style="color:#63b3ed;">3倍</span></div>
                    <div>・ﾂｰﾍﾟｱ(2枚×2組): <span style="color:#63b3ed;">2倍</span></div>
                    <div>・ﾜﾝﾍﾟｱ(2枚同じ): 1倍(返金)</div>
                    <div style="color:#a0aec0;">・ブタ(役なし): 没収</div>
                </div>
            </div>
        `;
    }

    changeView("view-minigame");
};

window.setRouletteBet = function (type) {
    mgState.rouletteBet = type;
    document.getElementById("mg-msg").innerText = `【${type === 'odd' ? '奇数' : '偶数'}】を選択しました。`;
    document.getElementById("btn-mg-play").disabled = false;
};
function getMinigameTargetChar(step) {
    if (!step) return state.player[0];
    let tId = step.targetId;
    if (tId) {
        let p = state.player.find(x => x.id === tId || x.originalId === tId);
        if (p) return p;
    }
    return state.player[0];
}

function getMinigameCurrency(step) {
    if (!step) return 0; // 門番（データがなければ何もしない）

    // 🌟 修正：推測を止め、渡された step のデータだけを使う！
    if (step.betType === "money") return state.money;

    // 🌟 修正：引数を忘れずにバトンタッチする
    let p = getMinigameTargetChar(step);

    if (step.betType === "hp") return p.hp;
    if (step.betType === "sp") return p.sp || 0;
    return 0;
}
async function addMinigameCurrency(step, amount) {
    if (!step) return false;

    if (step.betType === "money") {
        state.money = Math.max(0, state.money + amount);
    } else {
        let p = getMinigameTargetChar(step);

        if (step.betType === "hp") {
            p.hp += amount;
            if (p.hp > p.maxHp && amount > 0) p.maxHp = p.hp;

            if (p.hp <= 0) {
                p.hp = 0;
                updateMinigameUI();

                if (p.death_scene && SCENARIO[p.death_scene]) {
                    p.hp = 1;
                    let jumpDest = p.death_scene;
                    p.death_scene = "";
                    alert(`【警告】 ミニゲーム中に ${p.name} が限界を迎えました！\nイベントシーンへ移行します！`);

                    if (typeof agState !== 'undefined' && agState.loopId) { clearInterval(agState.loopId); clearTimeout(agState.loopId); agState.loopId = null; }
                    if (typeof agState !== 'undefined') agState.isPlaying = false;
                    if (typeof mgState !== 'undefined') mgState.isPlaying = false;

                    saveGame();
                    jumpTo(jumpDest);
                    return true;
                }
                else if (state.enablePermaDeath) {
                    alert(`【悲報】 ギャンブル（ミニゲーム）の代償として ${p.name} は 命を落としました……。`);
                    if (p.equip) state.ownedEquips.push(p.equip);
                    state.player = state.player.filter(char => char !== p);
                    if (state.player.length === 0) {
                        alert(`パーティが全滅しました……`);
                        changeView("view-title");
                    }
                    return true;
                }
                else {
                    alert(`【警告】 ${p.name} は ミニゲームの代償により 倒れてしまった！\n（※回復するまでバトルには参加できません）`);
                    return true;
                }
            }
        }
        if (step.betType === "sp") {
            p.sp = Math.max(0, (p.sp || 0) + amount);
        }
    }
    return false;
}

function updateMinigameUI() {
    document.getElementById("mg-currency-val").innerText = getMinigameCurrency(mgState.step);

    const playBtn = document.getElementById("btn-mg-play");
    const leaveBtn = document.getElementById("btn-mg-leave");

    // 残金不足チェック
    if (getMinigameCurrency(mgState.step) < mgState.step.betAmount) {
        playBtn.disabled = true;
        playBtn.innerText = "残高不足";
    }

    // 回数制限チェック
    if (mgState.step.playLimit > 0) {
        leaveBtn.innerText = "逃げる (残り " + mgState.playsLeft + " 回)";
        if (mgState.playsLeft <= 0) {
            playBtn.disabled = true;
            leaveBtn.innerText = "規定回数終了 (次へ)";
            leaveBtn.className = "btn-success w-100";
        }
    }
}

// 🟢 修正後（まるごと上書き用：ポーカーの再スタート処理を完璧にする！）
window.playMinigame = async function () {
    if (mgState.isPlaying) return;

    // 🌟 追加：ポーカーが終了（Phase 2）した状態で「もう一回遊ぶ」を押した場合、初期状態に戻す
    if (mgState.step.gameType === "poker" && mgState.pokerPhase === 2) {
        mgState.pokerPhase = 0;
        document.getElementById("mg-display").innerHTML = `<div style="font-size:40px; letter-spacing:10px;">READY?</div>`;
        document.getElementById("mg-msg").innerText = "カードを配ります...";
    }

    // ポーカーの交換フェーズ（カードを残して引き直す処理）
    if (mgState.step.gameType === "poker" && mgState.pokerPhase === 1) {
        await executePokerDraw();
        return; // 交換の時はベットを消費しないのでここで終わる
    }

    if (getMinigameCurrency(mgState.step) < mgState.step.betAmount) return;

    // 🌟 修正：コスト支払いで死んだらここでゲーム終了
    let isDead = await addMinigameCurrency(mgState.step, -mgState.step.betAmount);
    if (isDead) return;

    mgState.isPlaying = true;
    updateMinigameUI();

    document.getElementById("btn-mg-leave").disabled = true;
    const playBtn = document.getElementById("btn-mg-play");
    playBtn.disabled = true; // 🌟 実行中はボタン連打を防止

    // ゲーム実行
    if (mgState.step.gameType === "slot") await runSlot();
    else if (mgState.step.gameType === "roulette") await runRoulette();
    else if (mgState.step.gameType === "poker") await runPokerInit();

    // 後処理
    if (mgState.step.gameType !== "poker" || mgState.pokerPhase === 2) {
        // ポーカー以外なら、ここでプレイ回数を減らす（ポーカーは executePokerDraw の中で減らす）
        if (mgState.step.gameType !== "poker" && mgState.step.playLimit > 0) {
            mgState.playsLeft--;
        }
        mgState.isPlaying = false;

        document.getElementById("btn-mg-leave").disabled = false;
        // 回数制限が残っていればプレイボタンを復活させる
        if (mgState.step.playLimit === 0 || mgState.playsLeft > 0) {
            playBtn.disabled = false;
        }

        updateMinigameUI();
        saveGame();
    }
};
window.leaveMinigame = function () {
    if (mgState.isPlaying) return;
    state.currentStepIndex++;
    saveGame();
    jumpTo(mgState.step.nextScene);
};

// --- 🎰 スロット ---
async function runSlot() {
    const symbols = ["🍒", "🔔", "🍉", "👑", "７"];
    const display = document.getElementById("mg-display");
    document.getElementById("mg-msg").innerText = "祈れ！！";

    let result = [];
    for (let i = 0; i < 20; i++) {
        result = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];
        display.innerText = result.join(" ");
        await wait(50);
    }
    await wait(500);

    let multiplier = 0;
    if (result[0] === result[1] && result[1] === result[2]) {
        if (result[0] === "🍒") multiplier = 5;
        else if (result[0] === "🔔") multiplier = 10;
        else if (result[0] === "🍉") multiplier = 20;
        else if (result[0] === "👑") multiplier = 50;
        else if (result[0] === "７") multiplier = 100;
    }

    if (multiplier > 0) {
        const winAmt = mgState.step.betAmount * multiplier;
        document.getElementById("mg-msg").innerHTML = `<span style="color:#e53e3e;">大当たーり！！ ${winAmt} 獲得！！</span>`;
        addMinigameCurrency(mgState.step, winAmt);
        display.classList.add("shake");
        setTimeout(() => display.classList.remove("shake"), 500);
    } else {
        document.getElementById("mg-msg").innerText = "ハズレ...";
    }
}

// --- 🎡 ルーレット ---
async function runRoulette() {
    const display = document.getElementById("mg-display");
    document.getElementById("mg-msg").innerText = "ルーレット回転中...";

    let roll = 0;
    for (let i = 0; i < 20; i++) {
        roll = Math.floor(Math.random() * 36) + 1; // 1〜36
        display.innerText = roll;
        await wait(50);
    }
    await wait(500);

    let isOdd = (roll % 2 !== 0);
    let win = (mgState.rouletteBet === 'odd' && isOdd) || (mgState.rouletteBet === 'even' && !isOdd);

    if (win) {
        const winAmt = mgState.step.betAmount * 2;
        document.getElementById("mg-msg").innerHTML = `<span style="color:#e53e3e;">的中！！ ${winAmt} 獲得！！</span>`;
        addMinigameCurrency(mgState.step, winAmt);
        display.classList.add("shake");
        setTimeout(() => display.classList.remove("shake"), 500);
    } else {
        document.getElementById("mg-msg").innerText = "ハズレ...";
    }
}

// --- 🃏 ポーカー ---
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

async function runPokerInit() {
    mgState.pokerDeck = [];
    for (let s of SUITS) {
        for (let r of RANKS) {
            mgState.pokerDeck.push({ suit: s, rank: r });
        }
    }
    // シャッフル
    mgState.pokerDeck.sort(() => Math.random() - 0.5);

    mgState.pokerHand = [
        mgState.pokerDeck.pop(), mgState.pokerDeck.pop(), mgState.pokerDeck.pop(), mgState.pokerDeck.pop(), mgState.pokerDeck.pop()
    ];
    mgState.pokerHeld = [false, false, false, false, false];
    mgState.pokerPhase = 1;

    renderPokerCards();
    document.getElementById("mg-msg").innerText = "残すカードを選んで「交換」を押せ！";
    document.getElementById("btn-mg-play").innerText = "🔄 選択していないカードを交換";
    document.getElementById("btn-mg-play").disabled = false;
    mgState.isPlaying = false; // 入力待ち
}

window.togglePokerHold = function (idx) {
    if (mgState.pokerPhase !== 1) return;
    mgState.pokerHeld[idx] = !mgState.pokerHeld[idx];
    renderPokerCards();
};

function renderPokerCards() {
    let html = "";
    mgState.pokerHand.forEach((card, idx) => {
        let color = (card.suit === "♥" || card.suit === "♦") ? "red" : "black";
        let holdStyle = mgState.pokerHeld[idx] ? "border-color:#38a169; background:#c6f6d5;" : "border-color:#a0aec0; background:#fff;";
        html += `
        <div onclick="togglePokerHold(${idx})" style="cursor:pointer; flex:1; min-width:50px; padding:10px 0; border:4px solid; border-radius:8px; ${holdStyle}">
            <div style="font-size:16px; font-weight:bold; color:${color};">${card.suit}</div>
            <div style="font-size:24px; font-weight:bold; color:${color};">${card.rank}</div>
            <div style="font-size:10px; color:#2d3748; margin-top:5px;">${mgState.pokerHeld[idx] ? 'HOLD' : 'CHANGE'}</div>
        </div>`;
    });
    document.getElementById("mg-display").innerHTML = `<div style="display:flex; gap:5px; justify-content:space-between; width:100%;">${html}</div>`;
}

async function executePokerDraw() {
    mgState.isPlaying = true;
    document.getElementById("btn-mg-leave").disabled = true;
    document.getElementById("btn-mg-play").disabled = true;
    document.getElementById("mg-msg").innerText = "ドロー！";

    // アニメーション風にめくる
    for (let i = 0; i < 5; i++) {
        if (!mgState.pokerHeld[i]) {
            mgState.pokerHand[i] = mgState.pokerDeck.pop();
            renderPokerCards();
            await wait(500);
        }
    }
    await wait(500);

    // 役判定
    const ranksCount = {};
    const suitsCount = {};
    let isStraight = false;

    mgState.pokerHand.forEach(c => {
        ranksCount[c.rank] = (ranksCount[c.rank] || 0) + 1;
        suitsCount[c.suit] = (suitsCount[c.suit] || 0) + 1;
    });

    const counts = Object.values(ranksCount).sort((a, b) => b - a);
    const isFlush = Object.values(suitsCount).some(c => c === 5);

    // ストレート判定 (A=1, 14として扱う)
    let rankNums = mgState.pokerHand.map(c => RANKS.indexOf(c.rank) + 1).sort((a, b) => a - b);
    if (rankNums[0] === 1 && rankNums[1] === 10 && rankNums[2] === 11 && rankNums[3] === 12 && rankNums[4] === 13) {
        isStraight = true; // 10, J, Q, K, A のロイヤルストレート
    } else {
        isStraight = rankNums.every((val, i) => i === 0 || val === rankNums[i - 1] + 1);
    }

    let multiplier = 0;
    // 🌟 修正：「ブタ」という専門用語をやめ、分かりやすく「ハズレ」にする
    let handName = "ハズレ（役なし）";

    if (isStraight && isFlush && rankNums[0] === 1 && rankNums[1] === 10) { multiplier = 100; handName = "ロイヤルストレートフラッシュ"; }

    else if (isStraight && isFlush) { multiplier = 50; handName = "ストレートフラッシュ"; }
    else if (counts[0] === 4) { multiplier = 20; handName = "フォーカード"; }
    else if (counts[0] === 3 && counts[1] === 2) { multiplier = 10; handName = "フルハウス"; }
    else if (isFlush) { multiplier = 7; handName = "フラッシュ"; }
    else if (isStraight) { multiplier = 5; handName = "ストレート"; }
    else if (counts[0] === 3) { multiplier = 3; handName = "スリーカード"; }
    else if (counts[0] === 2 && counts[1] === 2) { multiplier = 2; handName = "ツーペア"; }
    else if (counts[0] === 2) { multiplier = 1; handName = "ワンペア"; } // 1倍（返金）

    if (multiplier > 0) {
        const winAmt = mgState.step.betAmount * multiplier;
        document.getElementById("mg-msg").innerHTML = `<span style="color:#e53e3e;">【${handName}】 ${winAmt} 獲得！！</span>`;
        addMinigameCurrency(mgState.step, winAmt);
    } else {
        document.getElementById("mg-msg").innerText = handName + " ...";
    }

    mgState.pokerPhase = 2; // 終了
    let cType = "G";
    if (mgState.step.betType === "hp") cType = "HP";
    if (mgState.step.betType === "sp") cType = "SP";

    const playBtn = document.getElementById("btn-mg-play"); // 🌟ボタンを取得
    playBtn.innerText = `${mgState.step.betAmount}${cType} 賭けて遊ぶ`;

    if (mgState.step.playLimit > 0) mgState.playsLeft--;
    mgState.isPlaying = false;

    document.getElementById("btn-mg-leave").disabled = false;

    // 🌟 修正：回数制限が残っており、かつお金（コスト）が足りていればボタンを復活させる！
    if ((mgState.step.playLimit === 0 || mgState.playsLeft > 0) && getMinigameCurrency() >= mgState.step.betAmount) {
        playBtn.disabled = false;
    }

    updateMinigameUI();
    saveGame();
}

// ==========================================
// 🔨 クラフト（料理・合成・鍛冶）システム
// ==========================================
let currentCraftCategory = "";
// 🌟追加：アトリエに入った時の目標アイテムの所持数を記憶する
let craftTargetBefore = 0;
let craftStepInfo = null;

window.openCraft = function (step) {
    currentCraftCategory = step.category || "";
    craftStepInfo = step; // 🌟追加：ステップ情報を記憶
    document.getElementById("craft-title").innerText = step.title || "🔨 アトリエ";

    // 🌟追加：ノルマが設定されていれば、入室時点の所持数をカウント
    if (step.targetItem) {
        let item = ITEMS[step.targetItem];
        if (item && item.type === "consumable") {
            craftTargetBefore = state.inventory[step.targetItem] || 0;
        } else {
            craftTargetBefore = state.ownedEquips.filter(id => id === step.targetItem).length;
        }
    }

    updateCraftUI();
    changeView("view-craft");
};

window.updateCraftUI = async function () {
    const list = document.getElementById("craft-list");
    let htmls = [];

    // レシピが設定されているアイテムをすべて探す
    for (const id of Object.keys(ITEMS)) {
        const item = ITEMS[id];
        if (!item.recipe) continue; // レシピがなければスキップ

        // カテゴリの絞り込み（設定されていれば）
        if (currentCraftCategory && item.craft_category !== currentCraftCategory) continue;

        // 🌟 修正：`|` 区切りで複数のレシピルート（作り方）を分割する
        const recipeRoutes = item.recipe.split('|').map(r => r.trim()).filter(r => r);

        // ルートごとにボタンを生成する
        for (let routeIndex = 0; routeIndex < recipeRoutes.length; routeIndex++) {
            const routeStr = recipeRoutes[routeIndex];

            // 1つのルートの材料を解析 "herb:2, water:1" -> [{id: "herb", req: 2}, {id: "water", req: 1}]
            const materials = routeStr.split(',').map(s => {
                const parts = s.split(':');
                return { matId: parts[0].trim(), req: parseInt(parts[1] || 1) };
            });

            // 材料が足りているかチェック＆表示テキストの作成
            let canCraft = true;
            let matTexts = [];

            for (const m of materials) {
                const matItem = ITEMS[m.matId];
                if (!matItem) continue; // エラー回避

                let hasCount = 0;
                if (matItem.type === "consumable") {
                    hasCount = state.inventory[m.matId] || 0;
                } else {
                    hasCount = state.ownedEquips.filter(eid => eid === m.matId).length;
                }
                if (hasCount < m.req) canCraft = false; // 1つでも足りなければ作成不可

                const color = hasCount >= m.req ? "#38a169" : "#e53e3e"; // 足りていれば緑、不足なら赤
                matTexts.push(`<span style="color:${color}; font-weight:bold;">${matItem.name}(${hasCount}/${m.req})</span>`);
            }

            // 所持品上限チェック (消費アイテムの場合)
            if (canCraft && item.type === "consumable" && state.maxItemCount > 0) {
                const currentHas = state.inventory[id] || 0;
                if (currentHas >= state.maxItemCount) canCraft = false;
            }

            const btnText = canCraft ? "合成する" : "素材不足";

            // 🌟 修正：引数に「何番目のレシピルートか」を渡す
            const btnAttr = canCraft ? `onclick="executeCraft('${id}', ${routeIndex})"` : "disabled";
            const routeLabel = recipeRoutes.length > 1 ? `<span style="background:#e2e8f0; color:#4a5568; font-size:10px; padding:2px 4px; border-radius:4px; margin-right:4px;">製法${routeIndex + 1}</span>` : "";

            const resolvedAA = await resolveAA(item.aa);

            htmls.push(`
            <div class="prep-char-card" style="${canCraft ? 'border-color:#3182ce; background:#ebf8ff;' : 'opacity:0.7; filter:grayscale(0.5);'}">
                <div class="item-aa-box" style="margin-right:10px;">
                    <pre class="item-aa" style="font-size:10px;">${resolvedAA}</pre>
                </div>
                <div style="flex:1">
                    <b style="font-size:14px;">${routeLabel}${item.name}</b> ${getEquipStatText(item)}<br>
                    <div style="font-size:11px; margin:4px 0;">必要素材: ${matTexts.join(" + ")}</div>
                    <small style="color:#718096;">${item.desc}</small>
                </div>
                <button class="cmd-btn" style="min-width:80px; ${canCraft ? 'background:#3182ce; color:#fff;' : ''}" ${btnAttr}>${btnText}</button>
            </div>`);
        }
    }

    if (htmls.length === 0) {
        list.innerHTML = "<div style='text-align:center; color:#718096; padding:20px;'>作れるレシピがありません...</div>";
    } else {
        list.innerHTML = htmls.join("");
    }
};

window.executeCraft = function (itemId, routeIndex = 0) {
    const item = ITEMS[itemId];
    if (!item || !item.recipe) return;

    // 1. 最終チェック（ズル防止）
    if (item.type === "consumable" && state.maxItemCount > 0) {
        if ((state.inventory[itemId] || 0) >= state.maxItemCount) {
            showToast("これ以上持てないお！", "error");
            return;
        }
    }

    // 🌟 修正：`|` 区切りのレシピから、プレイヤーが選んだルートだけを抽出する
    const recipeRoutes = item.recipe.split('|').map(r => r.trim()).filter(r => r);
    const targetRouteStr = recipeRoutes[routeIndex];
    if (!targetRouteStr) return; // エラー防止

    // 2. 材料の解析と消費（選ばれたルートのみ）
    const materials = targetRouteStr.split(',').map(s => {
        const parts = s.split(':');
        return { matId: parts[0].trim(), req: parseInt(parts[1] || 1) };
    });

    materials.forEach(m => {
        const matItem = ITEMS[m.matId];
        if (matItem && matItem.type === "consumable") {
            // 🌟 修正：消費後、0個以下なら抹消
            state.inventory[m.matId] = Math.max(0, (state.inventory[m.matId] || 0) - m.req);
            if (state.inventory[m.matId] <= 0) {
                delete state.inventory[m.matId];
            }
        } else {
            for (let i = 0; i < m.req; i++) {
                const idx = state.ownedEquips.indexOf(m.matId);
                if (idx !== -1) state.ownedEquips.splice(idx, 1);
            }
        }
    });

    // 3. アイテムの付与
    if (itemId === "orb_shinsei") {
        // 🌟 宝珠作成時：アイテム枠ではなくシステム変数を増やす（最大99）
        state.orbShinsei = Math.min(99, (state.orbShinsei || 0) + 1);
        showToast(`✨ 新生の宝珠 を作り出した！（貴重品に入りました）`, "success");
    } else if (item.type === "consumable") {
        state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
        showToast(`✨ ${item.name} を 作成したお！`, "success");
    } else {
        state.ownedEquips.push(itemId);
        showToast(`✨ ${item.name} を 作成したお！`, "success");
    }

    sysLog(`[クラフト] ${item.name} を合成しました（ルート${routeIndex + 1}）`);
    updateCraftUI(); // 画面を再描画

    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
};
window.leaveCraft = function () {
    let jumped = false;

    // 🌟追加：ノルマ判定と分岐
    if (craftStepInfo && craftStepInfo.targetItem) {
        let currentCount = 0;
        let item = ITEMS[craftStepInfo.targetItem];
        if (item && item.type === "consumable") {
            currentCount = state.inventory[craftStepInfo.targetItem] || 0;
        } else {
            currentCount = state.ownedEquips.filter(id => id === craftStepInfo.targetItem).length;
        }

        let craftedAmount = currentCount - craftTargetBefore;
        let targetReq = craftStepInfo.targetCount || 1;

        if (craftedAmount >= targetReq) {
            // 達成！
            if (craftStepInfo.trueNext) {
                jumpTo(craftStepInfo.trueNext);
                jumped = true;
            }
        } else {
            // 未達成…
            if (craftStepInfo.falseNext) {
                jumpTo(craftStepInfo.falseNext);
                jumped = true;
            }
        }
    }

    if (!jumped) {
        state.currentStepIndex++;
        nextStory();
    }
    saveGame();
};
// ==========================================
// 🎣 ⛏️ アクションミニゲーム（釣り・採掘）システム
// ==========================================
let agState = {
    step: null, isPlaying: false, isShowingResult: false, isWaitingRetry: false, loopId: null,
    successCount: 0, difficulty: 3,

    // ゲージ・QTE・連打用
    cursorPos: 0, direction: 1, speed: 2, hitMin: 40, hitMax: 60,
    qteTimeout: null, qteStart: 0, qteTimeLimit: 1000,
    mashCount: 0, mashTarget: 30, mashTime: 5.0,

    // 🌟 追加・修正：テトリス用（高さ7、形状・色を保持する変数を追加）
    tetrisGrid: [], tWidth: 5, tHeight: 12, tLines: 0, tTargetLines: 3,
    tPieceX: 2, tPieceY: 0, tPieceShape: [], tPieceColor: ""
};

// 🌟 ここも確実に追加されているかチェック！（ブロックの設計図）
const TETRIS_SHAPES = [
    { shape: [[1, 1], [1, 1]], color: "#ecc94b" }, // O型（四角・黄）
    { shape: [[1, 1, 1]], color: "#4299e1" },      // I型（横棒・水色）
    { shape: [[1], [1], [1]], color: "#4299e1" },  // I型（縦棒・水色）
    { shape: [[1, 1], [1, 0]], color: "#ed8936" }, // L型（小・オレンジ）
    { shape: [[1, 1], [0, 1]], color: "#ed8936" }, // J型（小・オレンジ）
    { shape: [[1, 1, 1], [0, 1, 0]], color: "#9f7aea" }, // T型（紫）
    { shape: [[1, 0], [1, 1], [1, 0]], color: "#9f7aea" }  // T型（縦・紫）
];
window.openActionGame = function (step) {
    agState.step = step;
    agState.isPlaying = false;
    agState.isShowingResult = false;
    agState.isWaitingRetry = false;
    agState.successCount = 0;
    agState.difficulty = step.difficulty || 3;

    const titleEl = document.getElementById("ag-title");
    const descEl = document.getElementById("ag-desc");
    const btnEl = document.getElementById("btn-ag-action");
    const msgEl = document.getElementById("ag-msg");

    // モード別のUIコンテナを切り替え
    document.getElementById("ag-gauge-container").style.display = "none";
    document.getElementById("ag-qte-container").style.display = "none";
    document.getElementById("ag-mash-container").style.display = "none";
    document.getElementById("ag-tetris-container").style.display = "none";

    // ボタンの初期化
    btnEl.className = "btn-primary w-100";
    btnEl.style.boxShadow = "0 6px 0 #2b6cb0 !important";
    btnEl.disabled = false;
    btnEl.onclick = null; // onmousedownに戻す

    // 🌟 修正：キャラクターが存在しない（0人）場合は、技術ボーナスを 0 にする安全装置
    let pTech = 0;
    if (state.player && state.player.length > 0) {
        pTech = getStats(state.player[0], true).tech;
    }
    let bonus = Math.floor(pTech / 25); // Tech25ごとにボーナス

    // モード別のタイトルと説明の自動セット
    let mgTitle = step.mgTitle || "";

    if (step.gameType === "gauge") {
        titleEl.innerHTML = `🎯 ${mgTitle || "タイミングアクション"}`; titleEl.style.color = "#48bb78";
        descEl.innerText = "ゲージが緑のエリアに入った瞬間にボタンを押せ！";
        btnEl.innerText = "アクション！";
        document.getElementById("ag-gauge-container").style.display = "block";

        let zoneSize = 20 + (bonus * 5); // Techでゾーン拡大
        agState.hitMin = 50 - (zoneSize / 2);
        agState.hitMax = 50 + (zoneSize / 2);
        document.getElementById("ag-hit-zone").style.left = `${agState.hitMin}%`;
        document.getElementById("ag-hit-zone").style.width = `${zoneSize}%`;
        agState.cursorPos = 0; agState.direction = 1; agState.speed = agState.difficulty * 1.5;
        document.getElementById("ag-cursor").style.left = "0%";
    }
    else if (step.gameType === "qte") {
        titleEl.innerHTML = `⚡ ${mgTitle || "クイックタイムイベント"}`; titleEl.style.color = "#ecc94b";
        descEl.innerText = "画面に【押せ！】が出たら、消える前に素早くタップしろ！";
        btnEl.innerText = "準備完了(開始)";
        document.getElementById("ag-qte-container").style.display = "block";
        document.getElementById("ag-qte-target").style.display = "none";

        // 難易度が高いほど表示時間が短い（Techで猶予時間アップ）
        agState.qteTimeLimit = Math.max(300, 1500 - (agState.difficulty * 200) + (bonus * 50));
    }
    else if (step.gameType === "mash") {
        titleEl.innerHTML = `💢 ${mgTitle || "連打チャレンジ"}`; titleEl.style.color = "#e53e3e";
        descEl.innerText = "制限時間内にボタンを連打してゲージを溜めろ！";
        btnEl.innerText = "連打開始！";
        document.getElementById("ag-mash-container").style.display = "block";

        agState.mashCount = 0;
        agState.mashTarget = 20 + (agState.difficulty * 5) - bonus; // Techで必要連打数ダウン
        agState.mashTarget = Math.max(10, agState.mashTarget);
        agState.mashTime = 5.0;
        document.getElementById("ag-mash-bar").style.width = "0%";
        document.getElementById("ag-mash-time").innerText = "5.0";
    }
    else if (step.gameType === "tetris") {
        titleEl.innerHTML = `🧩 ${mgTitle || "簡易ブロックパズル"}`; titleEl.style.color = "#805ad5";
        descEl.innerText = "ブロックを落として横一列に並べろ！規定ライン消去で成功！";
        btnEl.innerText = "ゲーム開始";
        document.getElementById("ag-tetris-container").style.display = "flex";

        agState.tTargetLines = Math.max(1, agState.difficulty - (bonus > 2 ? 1 : 0));
        initTetrisGrid();
    }

    let cType = step.betType === "hp" ? "HP" : (step.betType === "sp" ? "SP" : "G");
    msgEl.innerText = step.betAmount > 0 ? `消費: ${step.betAmount} ${cType}` : "準備はいいか？";

    changeView("view-action-game");
};

async function startActionGameLoop() {
    // 🌟 修正1：超強力な門番。agState やその中身が空っぽなら、絶対に処理を進めない！
    if (!agState || !agState.step) return;
    if (agState.isPlaying) return;

    // 🌟 修正2：途中で agState が消去されてもクラッシュしないように、今の設定を固定の変数にコピーしておく
    const currentStep = agState.step;
    if (!currentStep) return;
    if (agState.isPlaying) return;

    if (getMinigameCurrency(currentStep) < currentStep.betAmount) {
        document.getElementById("ag-msg").innerHTML = `<span style="color:#e53e3e;">コストが足りない！（休んで出直そう）</span>`;
        return;
    }

    let isDead = await addMinigameCurrency(currentStep, -currentStep.betAmount);
    if (isDead) return;

    // 支払いの await の間に連打キャンセルなどで agState が消えていたら即終了
    if (!agState || !agState.step) return;

    if (agState.loopId) { clearInterval(agState.loopId); clearTimeout(agState.loopId); agState.loopId = null; }
    if (agState.qteTimeout) { clearTimeout(agState.qteTimeout); agState.qteTimeout = null; }
    agState.isPlaying = true;
    agState.isShowingResult = false;
    agState.isWaitingRetry = false;

    // キャラクターの技術力によるボーナス（難易度緩和）の再計算
    let pTech = 0;
    if (state.player && state.player.length > 0) pTech = getStats(state.player[0], true).tech;
    let bonus = Math.floor(pTech / 25);

    const msgEl = document.getElementById("ag-msg");
    const btnEl = document.getElementById("btn-ag-action");
    const leaveBtn = document.getElementById("btn-ag-leave");

    // UIの初期化（ボタンをアクティブにする）
    btnEl.disabled = false;
    if (leaveBtn) leaveBtn.disabled = false;
    document.getElementById("ag-qte-target").style.display = "none";

    // ==========================================
    // モード別の「完全リセット ＆ スタート」処理
    // ==========================================
    if (currentStep.gameType === "gauge") {
        msgEl.innerText = "いまだ！！";
        btnEl.innerText = "アクション！";

        agState.cursorPos = 0;
        agState.direction = 1;
        document.getElementById("ag-cursor").style.left = "0%";

        agState.loopId = setInterval(() => {
            if (!agState || !agState.isPlaying) return; // 🌟 安全装置
            agState.cursorPos += agState.speed * agState.direction;
            if (agState.cursorPos >= 100) { agState.cursorPos = 100; agState.direction = -1; }
            else if (agState.cursorPos <= 0) { agState.cursorPos = 0; agState.direction = 1; }
            document.getElementById("ag-cursor").style.left = `${agState.cursorPos}%`;
        }, 20);
    }
    else if (currentStep.gameType === "qte") {
        msgEl.innerText = "集中しろ……！";
        btnEl.disabled = true; // メインボタンは使わず、画面上の的を押させる
        btnEl.innerText = "画面のボタンを押せ！";

        agState.qteTimeLimit = Math.max(300, 1500 - (agState.difficulty * 200) + (bonus * 50));

        agState.qteTimeout = setTimeout(() => {
            if (!agState || !agState.isPlaying) return;
            const target = document.getElementById("ag-qte-target");
            target.style.top = `${Math.random() * 60}%`;
            target.style.left = `${Math.random() * 80}%`;
            target.style.display = "block";
            agState.qteStart = Date.now();

            agState.loopId = setTimeout(() => {
                if (agState && agState.isPlaying) finishActionGame(false, "時間切れだ！");
            }, agState.qteTimeLimit);
        }, 1000 + Math.random() * 2000);
    }
    else if (currentStep.gameType === "mash") {
        msgEl.innerText = "連打しろ！！";
        btnEl.innerText = "オラオラオラ！！";

        agState.mashCount = 0;
        agState.mashTime = 5.0;
        agState.mashTarget = Math.max(10, 20 + (agState.difficulty * 5) - bonus);

        document.getElementById("ag-mash-bar").style.width = "0%";
        document.getElementById("ag-mash-time").innerText = "5.0";

        agState.loopId = setInterval(() => {
            if (!agState || !agState.isPlaying) return; // 🌟 安全装置
            agState.mashTime -= 0.1;
            document.getElementById("ag-mash-time").innerText = agState.mashTime.toFixed(1);
            if (agState.mashTime <= 0) {
                finishActionGame(false, "時間切れだ！");
            }
        }, 100);
    }
    else if (currentStep.gameType === "tetris") {
        agState.tTargetLines = Math.max(1, agState.difficulty - (bonus > 2 ? 1 : 0));
        msgEl.innerText = `目標: 残り ${agState.tTargetLines} ライン`;
        btnEl.disabled = true;
        btnEl.innerText = "十字キーで操作";

        initTetrisGrid();   // 盤面を更地にする
        spawnTetrisPiece(); // 新しいパーツを出す

        agState.speed = 1000 - (agState.difficulty * 100);
        agState.loopId = setInterval(tickTetris, agState.speed);
    }
}


window.executeActionGame = async function (e) {
    if (e && e.cancelable) e.preventDefault();
    if (e && e.type === 'touchstart') agState.lastTouch = Date.now();
    if (e && e.type === 'mousedown' && Date.now() - (agState.lastTouch || 0) < 500) return;

    if (agState.isWaitingRetry) {
        // 再挑戦ボタンが押された時の処理
        agState.isWaitingRetry = false;
        document.getElementById("ag-msg").innerText = "構えろ……";
        const btnEl = document.getElementById("btn-ag-action");
        btnEl.className = "btn-primary w-100";
        btnEl.style.boxShadow = "0 6px 0 #2b6cb0 !important";

        // UIリセット
        document.getElementById("ag-qte-target").style.display = "none";
        document.getElementById("ag-mash-bar").style.width = "0%";
        document.getElementById("ag-mash-time").innerText = "5.0";
        if (agState.step.gameType === "tetris") initTetrisGrid();

        startActionGameLoop();
        return;
    }

    if (!agState.isPlaying) {
        // まだ始まっていないならスタート
        startActionGameLoop();
        return;
    }

    // プレイ中のボタン押下処理（モード別）
    if (agState.step.gameType === "gauge") {
        let isSuccess = (agState.cursorPos >= agState.hitMin && agState.cursorPos <= agState.hitMax);
        finishActionGame(isSuccess, isSuccess ? "見事だ！" : "失敗... タイミングが合わなかった。");
    }
    else if (agState.step.gameType === "mash") {
        agState.mashCount++;
        let progress = (agState.mashCount / agState.mashTarget) * 100;
        document.getElementById("ag-mash-bar").style.width = `${Math.min(100, progress)}%`;
        if (progress >= 100) {
            finishActionGame(true, "押し切った！");
        }
    }
    // (※ QTEは的を直接クリックする、テトリスは専用ボタンなのでここは無視)
};
window.hitQTE = function (e) {
    if (e && e.cancelable) e.preventDefault();
    if (!agState.isPlaying || agState.step.gameType !== "qte") return;

    let reactTime = Date.now() - agState.qteStart;
    if (reactTime <= agState.qteTimeLimit) {
        finishActionGame(true, `反応速度: ${reactTime}ms !`);
    } else {
        finishActionGame(false, "遅すぎる！");
    }
};
async function finishActionGame(isSuccess, resultMsg) {
    agState.isPlaying = false;
    // 🌟 修正1：isShowingResult = true をここから削除（テトリスで誤作動させないため）

    if (agState.loopId) { clearInterval(agState.loopId); clearTimeout(agState.loopId); agState.loopId = null; }
    if (agState.qteTimeout) { clearTimeout(agState.qteTimeout); agState.qteTimeout = null; }

    const msgEl = document.getElementById("ag-msg");
    const btnEl = document.getElementById("btn-ag-action");
    const leaveBtn = document.getElementById("btn-ag-leave");

    // 🌟 修正2：テトリスの場合は、報酬処理の前に即座に「再挑戦」状態にして終了する
    if (agState.step.gameType === "tetris") {
        agState.isWaitingRetry = true; // 即座に再挑戦モードへ
        msgEl.innerHTML = `<span style="color:${isSuccess ? '#38a169' : '#e53e3e'}; font-size:20px;">${resultMsg}</span>`;
        btnEl.disabled = false;
        btnEl.innerText = "🔄 もう一度挑戦する";
        btnEl.className = "btn-success w-100";
        btnEl.style.boxShadow = "0 6px 0 #276749 !important";
        if (leaveBtn) leaveBtn.disabled = false;
        if (isSuccess) playGlitchEffect();
        return; // テトリスはここで終了（下の遅延処理には行かない）
    }

    // --- 以下、通常のアクション（ゲージ・QTE・連打）用の処理 ---
    agState.isShowingResult = true; // ここでフラグを立てる
    btnEl.disabled = true;
    btnEl.innerText = "確認中...";
    if (leaveBtn) leaveBtn.disabled = true;
    document.getElementById("ag-qte-target").style.display = "none";

    if (isSuccess) {
        agState.successCount++;
        let rewards = agState.step.rewards ? agState.step.rewards.split(",").map(s => s.trim()) : [];
        if (rewards.length > 0) {
            const getItemId = rewards[Math.floor(Math.random() * rewards.length)];
            const item = ITEMS[getItemId];
            if (item) {
                // 🌟 修正：消費アイテムの場合、最大所持数を超えないようにガードする
                if (item.type === "consumable") {
                    let current = state.inventory[getItemId] || 0;
                    let max = state.maxItemCount > 0 ? state.maxItemCount : 9999;
                    if (current < max) {
                        state.inventory[getItemId] = current + 1;
                    } else {
                        // 🌟 上限オーバー時は取得をキャンセルし、メッセージを変える
                        msgEl.innerHTML = `<span style="color:#e53e3e; font-size:16px;">${item.name} はいっぱいだ！</span>`;
                        return; // 下のゲット演出に進ませない
                    }
                } else {
                    state.ownedEquips.push(getItemId);
                }
                const itemAA = await resolveAA(item.aa);
                msgEl.innerHTML = `<div style="color:#38a169; font-size:14px; margin-bottom:5px;">${resultMsg}</div><pre style="font-size:12px; line-height:1.2; color:#fff; background:rgba(0,0,0,0.5); display:inline-block; padding:5px; border-radius:4px; margin-bottom:5px;">${itemAA}</pre><div style="color:#ecc94b; font-size:20px; text-shadow: 2px 2px 0 #000;">${item.name} ゲット！</div>`;
            }
        } else {
            msgEl.innerHTML = `<span style="color:#38a169; font-size:20px;">大成功！！<br><small>${resultMsg}</small></span>`;
        }
        playGlitchEffect();
    } else {
        msgEl.innerHTML = `<span style="color:#e53e3e; font-size:20px;">${resultMsg}</span>`;
    }

    // 1.5秒の余韻のあと、リスタートボタンを出す
    setTimeout(() => {
        agState.isShowingResult = false;
        agState.isWaitingRetry = true;

        btnEl.disabled = false;
        btnEl.innerText = "🔄 もう一度挑戦する";
        btnEl.className = "btn-success w-100";
        btnEl.style.boxShadow = "0 6px 0 #276749 !important";

        if (leaveBtn) leaveBtn.disabled = false;

    }, 1500);
}
window.leaveActionGame = function () {
    if (agState.isShowingResult) return; // 結果表示中は帰れない

    if (agState.loopId) { clearInterval(agState.loopId); clearTimeout(agState.loopId); agState.loopId = null; }
    agState.isPlaying = false;

    state.currentStepIndex++;
    saveGame();

    if (agState.successCount === 0 && agState.step.failScene) {
        jumpTo(agState.step.failScene);
    } else if (agState.successCount === 0 && agState.step.requireSuccess) {
        alert("成功するまでやめられないお！");
        state.currentStepIndex--; // インデックスを戻して閉じさせない
        return;
    } else if (agState.step.nextScene) {
        jumpTo(agState.step.nextScene);
    } else {
        nextStory();
    }
};


// 🍞 トースト通知を表示する関数
window.showToast = function (message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    toast.innerHTML = message;

    container.appendChild(toast);

    // 3秒後に自動で消す
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
};

// ==========================================
// 📜 バックログ（メッセージ履歴）システム
// ==========================================
window.openLogModal = function () {
    const modal = document.getElementById("log-modal");
    const content = document.getElementById("log-content");

    // 🌟 修正：既存のログDOMを毎回空にしてから、最新の100件だけを描画する
    content.innerHTML = "";

    let html = "";
    if (messageLog.length === 0) {
        html = "<div style='text-align:center; color:#718096; margin-top:50px;'>まだメッセージの履歴がありません。</div>";
    } else {
        messageLog.forEach(log => {
            if (log.type === "system") {
                html += `<div class="log-entry log-system">${log.text}</div>`;
            } else {
                html += `<div class="log-entry">
                    <div class="log-speaker">${log.speaker}</div>
                    <div>${log.text}</div>
                </div>`;
            }
        });
    }

    content.innerHTML = html;
    modal.style.display = "flex";

    document.querySelector(".app-container").style.pointerEvents = "none"; // 背後を触れなくする
    modal.style.pointerEvents = "auto"; // モーダル自体は触れるようにする

    // 開いた瞬間に一番下（最新のメッセージ）までスクロールする
    setTimeout(() => {
        content.scrollTop = content.scrollHeight;
    }, 10);
};


window.closeLogModal = function () {
    document.getElementById("log-modal").style.display = "none";
    const container = document.querySelector(".app-container");
    if (container) {
        container.style.pointerEvents = "auto";
        container.focus(); // 🌟 追加
    }
};

// ==========================================
// ⚔️ タクティカルバトル（盤面SRPG）システム
// ==========================================
// 1. 盤面の初期化と敵の自動配置
async function initTacticalBoard() {
    const board = document.getElementById("tac-board");
    board.innerHTML = "";

    const endBtn = document.getElementById("btn-tac-end");
    if (endBtn) endBtn.style.display = "none";

    // 🌟 これを関数の最初の方に移動または追加
    state.player.forEach(p => {
        p.x = -1; p.y = -1; p.hasActed = false;
        p.prevX = undefined; p.prevY = undefined;
    });

    // 🌟 追加：配置フェーズなら、次に配置すべきキャラ（生きている最初の味方）を特定する
    if (state.tacData.phase === "setup_player") {
        let maxP = state.battleMemberCount || 3;
        state.tacData.setupIndex = state.player.findIndex((p, i) => i < maxP && p.hp > 0 && p.x === -1);
    }

    // --- マス目生成（中略） ---
    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
            let cell = document.createElement("div");
            cell.className = "tac-cell";
            cell.id = `tcell-${x}-${y}`;
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.onclick = (e) => onTacticalCellClick(x, y, e);

            let char = '.';
            if (state.tacData.mapGrid[y] && state.tacData.mapGrid[y][x]) {
                char = state.tacData.mapGrid[y][x];
            }
            if (char === '#') cell.classList.add("wall");
            board.appendChild(cell);
        }
    }

    let enemyCount = state.enemy.length;
    let placed = 0;
    let attempts = 0;
    // 敵の初期配置
    while (placed < enemyCount && attempts < 100) {
        let x = Math.floor(Math.random() * 9);
        let y = Math.floor(Math.random() * 3);
        if (state.tacData.mapGrid[y][x] !== '#' && !getUnitAt(x, y)) {
            state.enemy[placed].x = x;
            state.enemy[placed].y = y;
            placed++;
        }
        attempts++;
    }

    // 🌟 修正：配置フェーズなら、次に置く「一軍の」味方のインデックスを探す
    if (state.tacData.phase === "setup_player") {
        let maxP = state.battleMemberCount || 3;
        // i < maxP の条件を入れることで、準備画面の控え（3番目以降）は無視する
        state.tacData.setupIndex = state.player.findIndex((p, i) => i < maxP && p.hp > 0 && p.x === -1);
    }
    
    // 🌟 追加：注視ユニットの初期化（画面下に敵が出っぱなしになるのを防ぐ）
    state.tacData.focusedUnit = null;

    updateTacticalUI();
}
// 🌐 PvP専用：盤面の初期化
async function initPvPTacticalBoard() {
    const board = document.getElementById("tac-board");
    board.innerHTML = "";

    const endBtn = document.getElementById("btn-tac-end");
    if (endBtn) endBtn.style.display = "none";

    let displayMap = [...state.tacData.mapGrid];
    if (!isHost) {
        displayMap.reverse();
    }

    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
            let cell = document.createElement("div");
            cell.className = "tac-cell";
            cell.id = `tcell-${x}-${y}`;
            cell.dataset.x = x;
            cell.dataset.y = y;
            // 🌟 修正：クリック時のイベント(e)を渡す
            cell.onclick = (e) => onTacticalCellClick(x, !isHost ? 8 - y : y, e);

            let char = displayMap[y] ? displayMap[y][x] : '.';
            if (char === '#') cell.classList.add("wall");
            board.appendChild(cell);
        }
    }

    state.tacData.setupIndex = 0;
    state.tacData.phase = "setup_player";
    updateTacticalUI();
    showToast("【配置フェーズ】 自分のキャラを下3行に置いてください", "info");
}
async function updateTacticalUI() {
    
    let allActiveChars = [...state.player.slice(0, state.battleMemberCount || 3), ...state.enemy];
    allActiveChars.forEach(c => {
        if (c && c.hp > 0) {
            const stats = getStats(c, state.player.includes(c));
            if (c.hp > stats.actualMaxHp) c.hp = stats.actualMaxHp;
            if (state.enableResistance) {
                if (c.curShock > stats.maxShock) c.curShock = stats.maxShock;
                if (c.curHeat > stats.maxHeat) c.curHeat = stats.maxHeat;
                if (c.curElec > stats.maxElec) c.curElec = stats.maxElec;
            }
        }
    });

    let allUnits = [...state.player.slice(0, state.battleMemberCount || 3), ...state.enemy];
    let target = state.tacData.selectedUnit || state.tacData.focusedUnit;

    // 🌟 マスのサイズを画面に合わせて動的に計算する
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 画面の幅と高さから、9マスが綺麗に収まるサイズを計算
    let maxCellW = Math.floor(screenWidth / 10);
    let maxCellH = Math.floor((screenHeight - 150) / 10);
    let cellSize = Math.min(maxCellW, maxCellH);
    
    // 小さすぎ（30px）、大きすぎ（80px）を防止
    cellSize = Math.max(30, Math.min(80, cellSize));

    // 計算したマスのサイズをCSSに適用！
    document.documentElement.style.setProperty('--tac-cell-size', `${cellSize}px`);

    let faceMap = new Map();
    for (let u of allUnits) {
        if (u.hp > 0 && u.x >= 0 && u.y >= 0) {
            let isPinch = (u.hp <= u.maxHp / 2) || (state.enableResistance && (u.breakShock > 0 || u.breakHeat > 0 || u.breakElec > 0));
            u.tempEmotion = isPinch ? "ピンチ" : "通常";
            let faceAA = await getFace(u);
            u.tempEmotion = null; 
            faceAA = faceAA.replace(/^\n+|\n+$/g, ''); 
            faceMap.set(u.id, faceAA);
        }
    }

    document.querySelectorAll(".tac-unit").forEach(el => el.remove());

    for (let u of allUnits) {
        if (u.hp > 0 && u.x >= 0 && u.y >= 0) {
            let uEl = document.createElement("div");
            uEl.className = `tac-unit avatar-slot ${state.player.includes(u) ? 'player' : 'enemy'} ${u.hasActed ? 'done' : ''}`;

            if (state.tacData.selectedUnit === u || target === u) {
                uEl.classList.add("selected-glow");
            }

            let faceAA = faceMap.get(u.id) || "👤";
            uEl.innerHTML = `<pre class="avatar-aa" id="tac-aa-${u.id}">${faceAA}</pre>`;

            let drawY = (state.isPvP && typeof isHost !== 'undefined' && !isHost) ? 8 - u.y : u.y;
            let targetCell = document.getElementById(`tcell-${u.x}-${drawY}`);

            if (targetCell) {
                targetCell.appendChild(uEl);
                // 🌟 AAのサイズも、計算した cellSize に合わせる！
                applyAAScale(`tac-aa-${u.id}`, cellSize);
            }
        }
    }

    const msgEl = document.getElementById("tac-msg");
    const infoPanel = document.getElementById("tac-unit-info");

    if (state.tacData.phase === "setup_player") {
        let p = state.player[state.tacData.setupIndex];
        while (p && p.hp <= 0) {
            state.tacData.setupIndex++;
            p = state.player[state.tacData.setupIndex];
        }
        if (p) {
            msgEl.innerText = `【配置】 ${p.name} を自陣(下3行)に置いてください`;
            msgEl.style.color = "#63b3ed";
        }
    } else if (state.tacData.phase === "setup_done") {
        msgEl.innerText = `【配置完了】 「出撃する」を押してください`;
        msgEl.style.color = "#48bb78";
    } else {
        if (state.tacData.turn === "player") {
            msgEl.innerText = "あなたのターンだお！";
            msgEl.style.color = "#ecc94b";
        } else {
            msgEl.innerText = "敵の行動中だお...";
            msgEl.style.color = "#fc8181";
        }
    }

    const boardContainer = document.getElementById("tac-board-container");
    if (boardContainer) {
        if (state.tacData.phase === "wait_sync" || (state.tacData.phase === "battle" && state.tacData.turn !== "player")) {
            boardContainer.style.pointerEvents = "none";
            boardContainer.style.opacity = "0.7";
        } else {
            boardContainer.style.pointerEvents = "auto";
            boardContainer.style.opacity = "1";
        }
    }

    if (target) {
        infoPanel.style.display = "flex";

        // 🌟 左右回避ロジック（そのまま維持）
        if (target.x > 4) {
            infoPanel.style.left = "15px";
            infoPanel.style.right = "auto";
        } else {
            infoPanel.style.right = "15px";
            infoPanel.style.left = "auto";
        }
        
        // 1. キャラカードの生成（バトル画面と同じものを生成）
        let cardHtml = await generateCharCardHTML(target, "party", { 
            idx: 0, 
            isActive: false, 
            isReady: false 
        });

        // 2. 詳細ステータス（ブレイク攻撃力）
        const stats = getStats(target, state.player.includes(target));
        let statHtml = `
            <div style="background:rgba(26, 32, 44, 0.85); padding:8px; border-radius:6px; border:1px solid #4a5568; width:100%; font-size:11px; color:#a0aec0; margin-top:5px; box-sizing:border-box;">
                <div style="color:#e2e8f0; font-weight:bold; margin-bottom:5px; text-align:center; border-bottom:1px solid #4a5568; padding-bottom:4px;">攻撃性能</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>物理:</span> <span style="color:#e2e8f0; font-weight:bold;">${stats.dmg}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>衝攻:</span> <span style="color:#ecc94b; font-weight:bold;">${stats.atkShock}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>熱攻:</span> <span style="color:#fc8181; font-weight:bold;">${stats.atkHeat}</span></div>
                <div style="display:flex; justify-content:space-between;"><span>電攻:</span> <span style="color:#63b3ed; font-weight:bold;">${stats.atkElec}</span></div>
            </div>
        `;

        // 3. アクションボタン（🌟 修正：最上部に横並びで配置するためのHTML）
        let actionButtons = "";
        if (state.tacData.phase === "battle" && state.tacData.turn === "player" && state.tacData.movedUnit && state.tacData.selectedUnit === target) {
            actionButtons = `
                <div style="display:flex; gap:5px; width:100%; margin-bottom:10px;">
                    <button class="btn-cancel" style="flex:1; padding:12px 0; font-size:14px; box-shadow: 0 4px 0 #4a5568 !important; position:relative; z-index:10;" onclick="cancelTacMove()">↩️ 戻る</button>
                    <button class="btn-primary" style="flex:1; padding:12px 0; font-size:14px; box-shadow: 0 4px 0 #2b6cb0 !important; position:relative; z-index:10;" onclick="commitTacWait()">✋ 待機</button>
                </div>
            `;
        }

        // 4. HTMLの合体（🌟 修正：ボタンを一番上に置き、名前の重複を消した）
        infoPanel.innerHTML = `
            ${actionButtons}
            <div class="tac-info-inner">
                <!-- 🌟 修正：カードのサイズを少し縮小して表示 -->
                <div class="tac-card-scaler" style="transform: scale(0.9); transform-origin: top center; width: 100%; display: flex; justify-content: center; margin-bottom: -10px;">
                    ${cardHtml}
                </div>
                ${statHtml}
            </div>
        `;
        
        infoPanel.style.borderColor = state.player.includes(target) ? "#3182ce" : "#e53e3e";
        
        // 🌟 最重要修正：カードが描画された直後に、AAだけをマップと同じ方式で確実にリサイズする！
        requestAnimationFrame(() => {
            const cardAA = infoPanel.querySelector('.p-aa pre');
            if (cardAA) {
                // p-aa（親の檻）の高さを固定し、はみ出しを隠す
                cardAA.parentElement.style.height = "140px";
                cardAA.parentElement.style.overflow = "hidden";
                cardAA.parentElement.style.position = "relative";
                
                // コピー機方式（scale）でAAを枠の中に絶対に収める魔法
                applyAAScale(cardAA.id || cardAA.parentElement.id, 140);
            }
        });

    } else {
        infoPanel.style.display = "none";
    }

}
// 4. 座標からユニットを取得する便利関数
function getUnitAt(x, y) {
    // 🌟 修正：x, y が 0以上（盤面に配置済み）であることも条件に加える
    let p = state.player.slice(0, state.battleMemberCount || 3).find(u => u.hp > 0 && u.x >= 0 && u.y >= 0 && u.x === x && u.y === y);
    if (p) return { unit: p, isPlayer: true };
    let e = state.enemy.find(u => u.hp > 0 && u.x >= 0 && u.y >= 0 && u.x === x && u.y === y);
    if (e) return { unit: e, isPlayer: false };
    return null;
}
// 5. 本戦スタート（先手判定）
function startTacticalTurn() {
    // 🌟 修正2：もしフェーズが「配置中」または「配置完了」でない場合のみバトルを開始する
    // （ロード直後や、何かの間違いで呼ばれた時は弾く）
    if (state.tacData.phase === "setup_player") return;

    state.tacData.phase = "battle";

    const endBtn = document.getElementById("btn-tac-end");
    if (endBtn) {
        endBtn.style.display = "block";
        endBtn.innerText = "ターン終了";
        endBtn.className = "btn-warning w-100";
        endBtn.style.boxShadow = "";
        endBtn.onclick = tacEndTurn;
    }

    // エディタの設定に基づいて先攻を決める
    if (state.tacData.initiative === "player") {
        state.tacData.turn = "player";
    } else if (state.tacData.initiative === "enemy") {
        state.tacData.turn = "enemy";
    } else {
        // デフォルト：技＋経の合計値で勝負
        let pSum = 0, eSum = 0;
        state.player.slice(0, state.battleMemberCount || 3).forEach(p => { if (p.hp > 0 && p.x >= 0) pSum += p.tech + p.exp; });
        state.enemy.forEach(e => { if (e.hp > 0 && e.x >= 0) eSum += e.tech + e.exp; });

        if (pSum > eSum) state.tacData.turn = "player";
        else if (eSum > pSum) state.tacData.turn = "enemy";
        else state.tacData.turn = Math.random() < 0.5 ? "player" : "enemy";
    }

    showToast(`${state.tacData.turn === "player" ? "味方" : "敵"} の先制攻撃！`, "info");
    updateTacticalUI();

    // 敵が先攻になった場合、AIターンのループをスタートさせる
    if (state.tacData.turn === "enemy") {
        if (!state.isPvP) {
            startEnemyTacticalTurn();
        } else {
            showToast("相手の行動を待っています...", "info");
        }
    }
}
// ==========================================
// ⚔️ タクティカルバトル（移動・攻撃・AI）
// ==========================================
// 6. クリック時の挙動（移動・攻撃対象の選択・キャンセル）
window.onTacticalCellClick = function (x, y, e) {
    if (e) e.stopPropagation();
    if (state.isAnimating) return;

    const cell = document.getElementById(`tcell-${x}-${y}`);
    if (cell.classList.contains("wall")) return;

    const clickedData = getUnitAt(x, y);

    // 【フェーズ1：味方の初期配置】
    if (state.tacData.phase === "setup_player" || state.tacData.phase === "setup_done") {
        let maxP = state.battleMemberCount || 3;

        if (clickedData) {
            if (clickedData.isPlayer) {
                clickedData.unit.x = -1;
                clickedData.unit.y = -1;
                state.tacData.phase = "setup_player";
                const endBtn = document.getElementById("btn-tac-end");
                if (endBtn) endBtn.style.display = "none";
                state.tacData.setupIndex = state.player.findIndex((p, i) => i < maxP && p.hp > 0 && p.x === -1);
                updateTacticalUI();
            } else {
                showToast("そこには敵がいるお！", "warning");
            }
            return;
        }

        if (state.tacData.phase === "setup_done") return; 
        if (y < 6) { showToast("味方を配置できるのは下3行(自陣)だけだお！", "warning"); return; }

        let p = state.player[state.tacData.setupIndex];

        if (p) {
            p.x = x; p.y = y; 
            state.tacData.setupIndex = state.player.findIndex((pl, i) => i < maxP && pl.hp > 0 && pl.x === -1);

            if (state.tacData.setupIndex === -1) {
                state.tacData.phase = "setup_done";

                const endBtn = document.getElementById("btn-tac-end");
                if (endBtn) {
                    endBtn.style.display = "block";
                    endBtn.innerText = "⚔️ この配置で出撃する！";
                    endBtn.className = "btn-danger w-100";
                    endBtn.style.boxShadow = "0 6px 0 #c53030 !important";

                    endBtn.onclick = function () {
                        endBtn.innerText = "ターン終了";
                        endBtn.className = "btn-warning w-100";
                        endBtn.style.boxShadow = "";
                        endBtn.onclick = tacEndTurn;

                        if (state.isPvP) {
                            state.tacData.phase = "wait_sync";
                            showToast("出撃完了！ 相手の配置を待機中...", "info");
                            let setupSeed = Math.floor(originalMathRandom() * 4294967296);
                            let myPositions = state.player.slice(0, maxP).map(pl => ({ id: pl.id, x: pl.x, y: pl.y }));
                            conn.send({ type: 'TAC_SETUP_DONE', positions: myPositions, seed: setupSeed });
                            enablePvPRandom(setupSeed);
                            if (typeof triggerOmenTrait === "function") triggerOmenTrait();
                            if (typeof checkPvPTacSetup === "function") checkPvPTacSetup();
                        } else {
                            showToast("出撃！ 戦闘開始！", "success");
                            startTacticalTurn();
                        }
                    };
                }
                showToast("配置が完了しました。「出撃する」を押してください。", "success");
            }
            updateTacticalUI();
        }
        return;
    }

    // 【フェーズ2：戦闘（移動・攻撃）】
    if (state.tacData.phase !== "battle" || state.tacData.turn !== "player") return;

    // 🌟 修正1：注視（情報を見るだけ）の対象を更新
    if (clickedData) {
        state.tacData.focusedUnit = clickedData.unit;
    } else {
        state.tacData.focusedUnit = null; // 何もない床を叩いたら「誰も見ていない」にする
    }

    // --- 選択中（操作中）のキャラがいる場合 ---
    if (state.tacData.selectedUnit) {
        let su = state.tacData.selectedUnit;
        let isAttack = cell.classList.contains("attackable") && clickedData && (state.player.includes(su) !== clickedData.isPlayer);

        if (isAttack) {
            if (su.justEscaped) {
                showToast("退却したユニットは、このターン攻撃できないお！", "warning");
                return;
            }
            if (su.prevX === undefined) { su.prevX = su.x; su.prevY = su.y; }

            su.hasActed = true;
            let maxDuel = state.battleMemberCount || 3;
            let cx = su.x, cy = su.y;
            let getInRange = (t) => t.filter(u => u.hp > 0 && u.x !== undefined && (Math.abs(u.x - cx) + Math.abs(u.y - cy)) <= 2);

            let duelPlayersIds = [su.id, ...getInRange(state.player).filter(p => p !== su).map(p => p.id)].slice(0, maxDuel);
            let duelEnemiesIds = [clickedData.unit.id, ...getInRange(state.enemy).filter(e => e !== clickedData.unit).map(e => e.id)].slice(0, maxDuel);

            state.tacData.selectedUnit = null;
            state.tacData.focusedUnit = null; // 🌟 攻撃決定時もUIを消すためにリセット
            clearCellHighlights();
            updateTacticalUI();

            let duelSeed = Math.floor(originalMathRandom() * 4294967296);
            if (state.isPvP && typeof conn !== "undefined" && conn) {
                conn.send({
                    type: 'TAC_MOVE_ACTION',
                    actorId: su.id, moveX: su.x, moveY: su.y, targetId: clickedData.unit.id,
                    seed: duelSeed, isSupport: false, 
                    duelPIds: duelPlayersIds, duelEIds: duelEnemiesIds
                });
            }
            if (state.isPvP) enablePvPRandom(duelSeed);

            startTacticalDuel(su, clickedData.unit, false, duelPlayersIds, duelEnemiesIds);
            return;
        }

        // --- 移動の処理 ---
        if (!state.tacData.movedUnit && (cell.classList.contains("movable") || (su.x === x && su.y === y))) {
            su.prevX = su.x;
            su.prevY = su.y;
            su.x = x; su.y = y;
            state.tacData.movedUnit = su;

            drawAttackableCells(su);
            updateTacticalUI();
            return;
        }

        // 移動後に別の味方を選び直す
        if (clickedData && clickedData.isPlayer && !clickedData.unit.hasActed && clickedData.unit !== su) {
            if (state.tacData.movedUnit) {
                su.x = su.prevX; su.y = su.prevY;
                state.tacData.movedUnit = null;
            }
            state.tacData.selectedUnit = clickedData.unit;
            state.tacData.focusedUnit = null; // 🌟 選択し直した時は注視をリセット

            drawMovableCells(clickedData.unit);
            drawAttackableCells(clickedData.unit, true);
            updateTacticalUI();
            return;
        }

        // 🌟 修正2：範囲外や何もない床をクリックした場合は選択をキャンセルしてUIを更新！
        if (state.tacData.movedUnit) {
            su.x = su.prevX; su.y = su.prevY;
            state.tacData.movedUnit = null;
        }
        state.tacData.selectedUnit = null;
        clearCellHighlights();
        updateTacticalUI(); // 👈 これが抜けていたため、キャンセルしても画面が変わらなかった！
        return;
    }

    // --- 行動前の味方をクリックした時 ---
    if (clickedData && clickedData.isPlayer) {
        if (clickedData.unit.hasActed) {
            showToast("このキャラはすでに行動済みだお！", "warning");
            // 🌟 追加：行動済みの味方をタップした時もUIを出して見れるようにする
            updateTacticalUI(); 
            return;
        }
        state.tacData.selectedUnit = clickedData.unit;
        state.tacData.focusedUnit = null; // 🌟 選択中なので注視はリセット
        state.tacData.movedUnit = null;

        drawMovableCells(clickedData.unit);
        drawAttackableCells(clickedData.unit, true);
        updateTacticalUI();
    } else {
        // 🌟 追加：誰もいない床や、敵をタップした時
        // focusedUnit は冒頭でセットされているので、ここで画面を更新するだけでUIが出たり消えたりする！
        updateTacticalUI();
    }
};
// ==========================================
// ⚔️ タクティカルバトル：プレイヤーの手動操作支援
// ==========================================
window.cancelTacMove = function () {
    let su = state.tacData.selectedUnit;
    if (su && state.tacData.movedUnit) {
        // 🌟 追加：一度すべてのハイライトを消去する
        clearCellHighlights();

        // 座標を移動前に戻す
        su.x = su.prevX;
        su.y = su.prevY;
        state.tacData.movedUnit = null;

        // 再び移動可能範囲を描画する
        drawMovableCells(su);
        drawAttackableCells(su, true);
        updateTacticalUI();
    }
};
window.commitTacWait = function () {
    let su = state.tacData.selectedUnit;
    if (su) {
        su.hasActed = true; // 行動済みにする
        state.tacData.selectedUnit = null;
        state.tacData.movedUnit = null;
        clearCellHighlights();
        checkTacticalTurnEnd(); // ターンを終了すべきかチェック
    }
};
// 7. 移動可能範囲の描画（既存の関数の上書き用）
window.drawMovableCells = function (unit) {
    clearCellHighlights();
    const MOVE_RANGE = 3;

    let queue = [{ x: unit.x, y: unit.y, cost: 0 }];
    let visited = new Set([`${unit.x},${unit.y}`]);

    while (queue.length > 0) {
        let cur = queue.shift();

        if (cur.cost <= MOVE_RANGE) {
            let drawY = (state.isPvP && typeof isHost !== 'undefined' && !isHost) ? 8 - cur.y : cur.y;
            let cell = document.getElementById(`tcell-${cur.x}-${drawY}`);
            if (cell) cell.classList.add("movable");
        }

        if (cur.cost >= MOVE_RANGE) continue;

        const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        for (let d of dirs) {
            let nx = cur.x + d.x, ny = cur.y + d.y;
            let key = `${nx},${ny}`;

            if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9 && !visited.has(key)) {
                let isWall = state.tacData.mapGrid[ny] && state.tacData.mapGrid[ny][nx] === '#';
                let hasUnit = getUnitAt(nx, ny);

                if (!isWall && !hasUnit) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, cost: cur.cost + 1 });
                }
            }
        }
    }
};

// 8. 攻撃可能範囲の描画
window.drawAttackableCells = function (unit, skipClear = false) {
    if (!skipClear) clearCellHighlights();

    // 🌟 装備している武器の中から最大の「射程」を取得（デフォルトは1）
    let attackRange = 1;
    let eqList = Array.isArray(unit.equips) ? unit.equips : (unit.equip ? [unit.equip] : []);
    eqList.forEach(eid => {
        if (eid && ITEMS[eid] && ITEMS[eid].range) {
            attackRange = Math.max(attackRange, ITEMS[eid].range);
        }
    });

    // 🌟 射程に合わせて、壁を迂回しながら届くマスを幅優先探索(BFS)で塗りつぶす
    let queue = [{ x: unit.x, y: unit.y, cost: 0 }];
    let visited = new Set([`${unit.x},${unit.y}`]);

    while (queue.length > 0) {
        let cur = queue.shift();

        // 射程内のマスにユニットがいるか判定
        if (cur.cost > 0 && cur.cost <= attackRange) {
            let targetData = getUnitAt(cur.x, cur.y);
            if (targetData) {
                let targetDrawY = (state.isPvP && typeof isHost !== 'undefined' && !isHost) ? 8 - cur.y : cur.y;
                let cell = document.getElementById(`tcell-${cur.x}-${targetDrawY}`);
                if (cell) {
                    // 🌟 修正：自分と「違うチーム」のキャラ（敵）だけを赤く塗る
                    const isSameTeam = (state.player.includes(unit) === targetData.isPlayer);
                    if (!isSameTeam) {
                        cell.classList.add("attackable");
                    }
                }
            }
        }

        // 射程の限界に達したらこれ以上は広げない
        if (cur.cost >= attackRange) continue;

        const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        for (let d of dirs) {
            let nx = cur.x + d.x, ny = cur.y + d.y;
            let key = `${nx},${ny}`;

            if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9 && !visited.has(key)) {
                // 壁越しには攻撃できない（壁は通れない）仕様
                let isWall = state.tacData.mapGrid[ny] && state.tacData.mapGrid[ny][nx] === '#';
                if (!isWall) { 
                    visited.add(key);
                    queue.push({ x: nx, y: ny, cost: cur.cost + 1 });
                }
            }
        }
    }
};

window.clearCellHighlights = function () {
    document.querySelectorAll(".tac-cell").forEach(c => {
        c.classList.remove("movable", "attackable", "supportable", "selected");
    });
};


// 10. ターン終了チェックと切り替え
async function checkTacticalTurnEnd() {
    updateTacticalUI();
    let isAllDone = true;

    if (state.tacData.turn === "player" && state.player.every(p => !p.hasActed)) {
        state.tacData.hasEscapedThisRound = false;
    }

    if (state.tacData.turn === "player") {
        state.player.slice(0, state.battleMemberCount || 3).forEach(p => {
            if (p.hp > 0 && p.x !== undefined && !p.hasActed) isAllDone = false;
        });
        if (isAllDone) {
            showToast("プレイヤーのターン終了", "info");
            state.tacData.turn = "enemy";
            state.shingariActive = false;

            (async () => {
                // 🌟 ここを修正：盤面ではここではダメージ計算をせず、耐性復旧(processResTurnEnd)だけを行うようにする
                // または、一巡（敵の終了時）だけ実行するように分岐させる
                if (await checkTacticalDead()) return;

                if (state.isPvP && conn) {
                    conn.send({ type: 'TAC_TURN_END' });
                } else {
                    startEnemyTacticalTurn();
                }
            })();
        }
     } else {
        // (前略：敵全員が動いたかのチェック)
        state.enemy.forEach(e => {
            if (e.hp > 0 && e.x !== undefined && !e.hasActed) isAllDone = false;
        });

        if (!state.isPvP && isAllDone) {
            await showMsg("敵のターン終了", "warning");

            (async () => {
                // 🌟 追加：このラウンドの全行動が終わったので、世界の時間を1進める
                state.turnCount++;

                // 🌟 追加：全員に毒ダメージや自動回復、状態異常ターンの消費を適用する
                // （processAllStatusTurnEnd 関数を使って一括処理する）
                await processAllStatusTurnEnd();

                if (await checkTacticalDead()) return;

                // 状態を「プレイヤーの手番」に戻す
                state.player.forEach(p => { p.hasActed = false; p.justEscaped = false; });
                state.enemy.forEach(e => e.hasActed = false);

                state.tacData.turn = "player";
                state.tacData.hasEscapedThisRound = false;

                updateTacticalUI();
            })();
        }
    }
}

window.tacEndTurn = function () {
    if (state.isAnimating || state.tacData.turn !== "player") return;
    if (confirm("まだ行動していない味方がいますが、ターンを終了しますか？")) {
        state.player.slice(0, state.battleMemberCount || 3).forEach(p => p.hasActed = true);
        state.shingariActive = false; // 🌟 ここでも一応解除

        if (state.isPvP && conn) {
            state.tacData.turn = "enemy";
            conn.send({ type: 'TAC_TURN_END' });
            showToast("相手の行動を待っています...", "info");
        }

        checkTacticalTurnEnd();
    }
};

// 11. 敵のAIターン（自動移動＆攻撃）
async function startEnemyTacticalTurn() {
    // 🌟 余計なUI変数（infoPanel）を削除し、純粋に画面を更新して一呼吸置く
    updateTacticalUI();
    await wait(500);

    for (let i = 0; i < state.enemy.length; i++) {
        let e = state.enemy[i];
        if (e.hp <= 0 || e.hasActed) continue;

        // 行動不能のガード（石化、睡眠など）
        if (e.status === "stone" || e.status === "sleep") {
            document.getElementById("tac-msg").innerText = `敵軍：${e.name} は 【${STATUS_NAMES[e.status]}】で 動けない！`;
            e.hasActed = true;
            await wait(500);
            updateTacticalUI();
            continue;
        }
        // 反動で動けない場合のガード
        if (e.rechargeTurn > 0) {
            document.getElementById("tac-msg").innerText = `敵軍：${e.name} は 技の反動で動けない！`;
            e.rechargeTurn--;
            e.hasActed = true;
            await wait(500);
            updateTacticalUI();
            continue;
        }

        state.isAnimating = true;
        document.getElementById("tac-msg").innerText = `敵軍：${e.name} の行動...`;

        // ==========================================
        // ① ターゲット選定（誰を狙うか）
        // ==========================================
        let target = null;
        let minDist = 999;

        // ピンチ時の逃走モード切り替え
        let currentMoveType = e.ai_move_type || "closest";
        let hpPer = e.hp / e.maxHp;
        if (e.ai_move_pinch === "escape_50" && hpPer <= 0.50) currentMoveType = "coward";
        else if (e.ai_move_pinch === "escape_25" && hpPer <= 0.25) currentMoveType = "coward";

        if (currentMoveType === "stay") {
            target = null;
        }
        else if (currentMoveType === "healer") {
            let minHp = 99999;
            state.enemy.forEach(en => {
                if (en.hp > 0 && en !== e && en.x >= 0 && en.y >= 0) {
                    if (en.hp < minHp) { minHp = en.hp; target = en; }
                }
            });
        }
        else if (currentMoveType === "weakest") {
            let minHp = 99999;
            state.player.slice(0, state.battleMemberCount || 3).forEach(p => {
                if (p.hp > 0 && p.x >= 0 && p.y >= 0 && p.trait !== "stealth") {
                    if (p.hp < minHp) { minHp = p.hp; target = p; }
                }
            });
        }
        else {
            state.player.slice(0, state.battleMemberCount || 3).forEach(p => {
                if (p.hp > 0 && p.x >= 0 && p.y >= 0) {
                    let dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
                    if (p.trait === "stealth") dist += 10;
                    if (p.trait === "provoke_aura") dist -= 10;
                    if (dist < minDist) { minDist = dist; target = p; }
                }
            });
        }

        // ==========================================
        // 🌟復活：② 移動する（賢いルート探索：BFS）
        // ==========================================
        if (target) {
            let canMoveAtAll = false;
            const checkDirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
            for (let cd of checkDirs) {
                let cx = e.x + cd.x, cy = e.y + cd.y;
                if (cx >= 0 && cx < 9 && cy >= 0 && cy < 9) {
                    let isWallCell = state.tacData.mapGrid[cy] && state.tacData.mapGrid[cy][cx] === '#';
                    if (!isWallCell && !getUnitAt(cx, cy)) {
                        canMoveAtAll = true;
                        break;
                    }
                }
            }

            if (!canMoveAtAll) {
                await showMsg(`${e.name} は 身動きが取れない！`);
                await wait(500);
            } else {
                let moves = 3;

                if (currentMoveType === "coward" && target) {
                    let safeCounter = 0; 
                    let moved = false;   
                    while (moves > 0 && safeCounter < 10) {
                        safeCounter++;
                        let dx = Math.sign(e.x - target.x); 
                        let dy = Math.sign(e.y - target.y);
                        if (dx === 0 && dy === 0) { dx = 1; dy = 0; }

                        let nx = e.x + dx, ny = e.y;
                        // 🌟 修正：盤面の範囲内かを先にチェックしてエラーを防ぐ
                        let isWall = (ny >= 0 && ny < 9 && nx >= 0 && nx < 9) ? (state.tacData.mapGrid[ny] && state.tacData.mapGrid[ny][nx] === '#') : true;
                        
                        if (dx !== 0 && !isWall && !getUnitAt(nx, ny) && nx >= 0 && nx < 9) {
                            e.x = nx; e.y = ny; moved = true;
                        } else {
                            nx = e.x; ny = e.y + dy;
                            isWall = (ny >= 0 && ny < 9 && nx >= 0 && nx < 9) ? (state.tacData.mapGrid[ny] && state.tacData.mapGrid[ny][nx] === '#') : true;
                            if (dy !== 0 && !isWall && !getUnitAt(nx, ny) && ny >= 0 && ny < 9) {
                                e.x = nx; e.y = ny; moved = true;
                            }
                        }
                        moves--;
                        updateTacticalUI();
                        await wait(500);
                    }
                    if (!moved) {
                        await showMsg(`${e.name} は 逃げ場がなくて 震えている……`);
                        await wait(500);
                    }
                    target = null; // 逃げたので攻撃はしない
                }
                else if (Math.abs(target.x - e.x) + Math.abs(target.y - e.y) > 1) {
                    // 幅優先探索(BFS)による最短ルート計算
                    let queue = [{ x: e.x, y: e.y }];
                    let cameFrom = new Map(); 
                    cameFrom.set(`${e.x},${e.y}`, null); 

                    let foundAdjacent = null;

                    while (queue.length > 0) {
                        let cur = queue.shift();
                        if (Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y) === 1) {
                            foundAdjacent = cur;
                            break;
                        }

                        const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
                        for (let d of dirs) {
                            let nx = cur.x + d.x, ny = cur.y + d.y;
                            let key = `${nx},${ny}`;
                            if (nx >= 0 && nx < 9 && ny >= 0 && ny < 9 && !cameFrom.has(key)) {
                                let isWall = state.tacData.mapGrid[ny] && state.tacData.mapGrid[ny][nx] === '#';
                                let hasUnit = getUnitAt(nx, ny);
                                if (!isWall && !hasUnit) {
                                    cameFrom.set(key, { x: cur.x, y: cur.y });
                                    queue.push({ x: nx, y: ny });
                                }
                            }
                        }
                    }

                    // 実際の移動
                    if (foundAdjacent) {
                        let path = [];
                        let curr = foundAdjacent;
                        while (curr && (curr.x !== e.x || curr.y !== e.y)) {
                            path.push(curr);
                            curr = cameFrom.get(`${curr.x},${curr.y}`);
                        }
                        path.reverse();

                        for (let step of path) {
                            if (moves <= 0) break;
                            e.x = step.x; e.y = step.y;
                            moves--;
                            updateTacticalUI();
                            await wait(500); 
                        }
                    } else {
                        // 塞がっている場合のフォールバック
                        let dx = Math.sign(target.x - e.x);
                        let dy = Math.sign(target.y - e.y);
                        let nx = e.x + dx, ny = e.y;
                        if (dx !== 0 && (!state.tacData.mapGrid[ny] || state.tacData.mapGrid[ny][nx] !== '#') && !getUnitAt(nx, ny)) {
                            e.x = nx; e.y = ny; updateTacticalUI(); await wait(500);
                        } else {
                            nx = e.x; ny = e.y + dy;
                            if (dy !== 0 && (!state.tacData.mapGrid[ny] || state.tacData.mapGrid[ny][nx] !== '#') && !getUnitAt(nx, ny)) {
                                e.x = nx; e.y = ny; updateTacticalUI(); await wait(500);
                            }
                        }
                    }
                }
            } 
        }

        // ==========================================
        // ③ 攻撃判定
        // ==========================================
        let isAttacked = false;
        // 移動後、ターゲットが隣にいたら攻撃を仕掛ける
        if (target && Math.abs(target.x - e.x) + Math.abs(target.y - e.y) === 1) {
            isAttacked = true;

            await wait(500);
            state.isAnimating = false;

            await startTacticalDuel(e, target);
            if (!document.getElementById("view-tactical").classList.contains("active")) return;
        }

        if (!isAttacked) {
            e.hasActed = true;
            updateTacticalUI();
            await wait(500);
        }
    }

    state.isAnimating = false;
    checkTacticalTurnEnd();
}
// 12. 盤面戦の全滅・決着判定
async function checkTacticalDead() {
    let pAlive = state.player.slice(0, state.battleMemberCount || 3).some(p => p && p.hp > 0);
    
    // 🌟 修正2：勝利条件の判定強化（ボス指定があれば、それを優先する）
    let isEnemyAnnihilated = false;
    let bossEnemies = state.enemy.filter(e => e.isBoss === "true");

    if (bossEnemies.length > 0) {
        // ボスが設定されている場合：ボスが全員死んでいれば勝利！
        isEnemyAnnihilated = bossEnemies.every(boss => boss.hp <= 0);
    } else {
        // ボスがいない場合：敵が全員死んでいれば勝利！
        isEnemyAnnihilated = state.enemy.every(e => e.hp <= 0);
    }

    // 敵味方同時に死んでいたら、勝者なき相打ちルートへ
    if (!pAlive && isEnemyAnnihilated) {
        await showMsg(`<span style="color:#805ad5; font-size:24px;">【相打ち】</span><br>おたがいに 力尽きたお……`);
        await wait(500);

        if (state.isPvP) {
            endPvP();
            return true;
        }

        state.tacData = null;
        jumpTo(state.battleDrawNext || state.battleLoseNext);
        return true;
    }

    // PvP中の終了判定（通信）
    if (state.isPvP && (!pAlive || isEnemyAnnihilated)) {
        if (state.tacData.turn !== "player") return true;

        if (!pAlive && isEnemyAnnihilated) {
            await showMsg(`<span style="color:#ecc94b; font-size:24px;">【相打ち】</span><br>おたがいの 軍勢が 力尽きたお！`);
            if (conn) conn.send({ type: 'PVP_GAME_OVER', result: '引き分け' });
        } else if (isEnemyAnnihilated) {
            await showMsg(`<span style="color:#38a169; font-size:24px;">【完全勝利！！】</span><br>相手の 軍勢を ぜんめつさせたお！`);
            if (conn) conn.send({ type: 'PVP_GAME_OVER', result: 'あなたの負け' });
        } else if (!pAlive) {
            await showMsg(`<span style="color:#e53e3e; font-size:24px;">【敗北...】</span><br>こちらの 軍勢が たおれたお...`);
            if (conn) conn.send({ type: 'PVP_GAME_OVER', result: 'あなたの勝ち' });
        }
        await wait(500);
        endPvP(); 
        return true;
    }

    // 通常の相打ち
    if (isEnemyAnnihilated && !pAlive) {
        await showMsg(`<span style="color:#ecc94b; font-size:24px;">【相打ち】</span><br>おたがいの 軍勢が 力尽きたお！`);
        await wait(500);
        state.tacData = null; 
        jumpTo(state.battleLoseNext); 
        return true;
    }

    // 🌟 勝利判定！
    if (isEnemyAnnihilated) {
        if (bossEnemies.length > 0) {
            await showMsg(`<span style="color:#38a169; font-size:24px;">【作戦成功！！】</span><br>目標の ボス を 撃破したお！`);
        } else {
            await showMsg(`<span style="color:#38a169; font-size:24px;">【完全勝利！！】</span><br>盤面上の 敵を ぜんめつさせたお！`);
        }
        await wait(500);

        let tMoney = 0, tExp = 0;
        state.enemy.forEach(e => { 
            // ボス撃破で終わった場合、生き残っている雑魚の分はもらえない仕様にする
            if (e.hp <= 0) {
                tMoney += (e.dropMoney || 0); 
                tExp += (e.dropExp || 0); 
            }
        });
        state.money = Math.min(99999999, state.money + tMoney);

        state.tacData = null;
        openResultScreen(tMoney, tExp); // リザルト画面へ
        return true;
    }

    // 敗北判定
    if (!pAlive) {
        await showMsg(`<span style="color:#e53e3e; font-size:24px;">【全滅...】</span><br>こちらの 軍勢が たおれたお...`);
        await wait(500);

        state.tacData = null;
        if (state.battleLoseNext) {
            state.player.forEach(char => { if (char.hp <= 0) char.hp = 1; }); // ロストOFFならHP1で復活
            jumpTo(state.battleLoseNext);
        } else {
            await showMsg(`めのまえが まっくらになった……`);
            setTimeout(() => { changeView("view-title"); }, 3000);
        }
        return true;
    }

    return false; // まだ決着がついていない（戦闘続行）
}

// ==========================================
// 🌐 PvP専用：タクティカルバトルの初期化と反転ロジック
// ==========================================

// ゲスト用：座標を反転（9x9マスなので、Y座標を 8 - Y にする）
function flipY(y) {
    if (!isHost) return 8 - y;
    return y;
}
// ==========================================
// 🌐 PvP専用：お互いの配置が完了した時の処理
// ==========================================
function checkPvPTacSetup() {
    if (!state.tacData || state.tacData.phase !== "wait_sync") return;

    // 相手のデータが届いていれば開始
    if (state.tacData.opponentPositions) {

        // 相手の座標データを `state.enemy` に適用する（ゲストの場合は Y軸を反転させる！）
        state.tacData.opponentPositions.forEach(pos => {
            let e = state.enemy.find(en => en.id === pos.id);
            if (e) {
                e.x = pos.x;
                // 🌟 ここが超重要：自分と相手の画面で位置関係を揃える魔法！
                // ホスト側はゲストの配置(y:6〜8)を反転して敵陣(y:2〜0)に置く
                // ゲスト側はホストの配置(y:6〜8)を反転して敵陣(y:2〜0)に置く
                e.y = 8 - pos.y;
            }
        });

        showToast("両者の配置が完了しました！ 戦闘開始！", "success");
        startTacticalTurn();
    }
}

// ==========================================
// 🌐 PvP専用：相手の「1手」を受信した時の処理
// ==========================================
async function receivePvPTacAction(data) {
    if (!state.tacData) return;

    let enemyActor = state.enemy.find(e => e.id === data.actorId);
    let playerTarget = state.player.find(p => p.id === data.targetId);

    if (!enemyActor || !playerTarget) {
        console.error("キャラが見つかりません！通信ズレが発生しています。");
        return;
    }

    enemyActor.x = data.moveX;
    enemyActor.y = 8 - data.moveY;
    enemyActor.hasActed = true;

    state.isAnimating = true;
    document.getElementById("tac-msg").innerText = `敵軍：${enemyActor.name} が行動！`;

    updateTacticalUI();
    await wait(800);

    if (state.isPvP) enablePvPRandom(data.seed);

    // 🌟 修正：相手が決定したメンバーIDリストを渡して開始
    await startTacticalDuel(enemyActor, playerTarget, data.isSupport, data.duelPIds, data.duelEIds);
}
// ==========================================
// 🚨 エラー発生時の安全な強制送還ロジック
// ==========================================
let returnTimerId = null;

function forceReturnFromError() {
    if (returnTimerId) return;
    state.isWaitingChoice = true;
    document.querySelector(".app-container").style.pointerEvents = "auto"; // 追加

    returnTimerId = setTimeout(() => {
        const wasTestPlay = state.isTestPlay;

        // 🌟 修正：共通関数を呼ぶだけ！
        cleanupGameState();

        const exitBtn = document.getElementById("btn-exit-test");
        if (exitBtn) exitBtn.style.display = "none";

        if (wasTestPlay) changeView("view-editor");
        else changeView("view-title");
    }, 3000);
}

// ==========================================
// 🧹 システム・UI・フラグの完全初期化（クリーンアップ）
// ==========================================
window.cleanupGameState = function () {
    // 🌟 追加：通信状態なら確実に切断する
    if (typeof conn !== "undefined" && conn) { conn.close(); conn = null; }
    if (typeof peer !== "undefined" && peer) { peer.destroy(); peer = null; }
    if (typeof disablePvPRandom === "function") disablePvPRandom();

    // 1. タイマーの全停止
    if (typeof turnTimerInterval !== 'undefined' && turnTimerInterval) clearInterval(turnTimerInterval);
    if (typeof pvpTimerInterval !== 'undefined' && pvpTimerInterval) clearInterval(pvpTimerInterval);
    if (typeof stopPvPTimer === "function") stopPvPTimer(); // 🌟 追加
    if (typeof mapState !== 'undefined' && mapState.loopId) clearInterval(mapState.loopId);
    if (typeof returnTimerId !== 'undefined' && returnTimerId) { clearTimeout(returnTimerId); returnTimerId = null; }
    if (typeof clearMapTimers === 'function') clearMapTimers();

    // 🌟 進行中のメッセージやタイマーを強制完了
    isSkipping = true; 
    if (typeof currentMsgResolve === "function" && currentMsgResolve) currentMsgResolve();
    if (typeof activeWaits !== "undefined") {
        activeWaits.forEach(t => { clearTimeout(t.id); t.resolve(); });
        activeWaits = [];
    }

    // アクションミニゲームのタイマー
    if (typeof agState !== 'undefined') {
        if (agState.loopId) { clearInterval(agState.loopId); clearTimeout(agState.loopId); agState.loopId = null; }
        if (agState.qteTimeout) { clearTimeout(agState.qteTimeout); agState.qteTimeout = null; }
        agState.isPlaying = false;
        agState.isShowingResult = false;
        agState.isWaitingRetry = false;
    }

    // 🚨 追加：マップのジャンプフラグリセット
    if (typeof mapState !== 'undefined') {
        mapState.isJumping = false;
        mapState.isJumpingToScene = false;
    }

    // 2. State（進行状況）の初期化
    state.activeP = 0; state.activeE = 0;
    state.isAnimating = false; isSkipping = false;
    state.isTestPlay = false; state.isWaitingChoice = false;
    state.currentStepIndex = 0; state.turnCount = 1;
    state.day = 1; state.timePeriod = 1;
    state.money = 500; state.orbShinsei = 0;
    state.inventory = { heal_1: 3, smoke_1: 2, sniper_1: 1, decoy_1: 2, coolant_1: 2 };
    state.ownedEquips = ["sw_1"];
    state.flags = {};

    // 🚨 修正：プレイヤーステータスの余分なフラグを完全に掃除
     if (state.player) {
        state.player.forEach(p => cleanUpCharacterBattleFlags(p));
    }
    state.enemy = []; // 敵のデータも確実に空にする

    state.partyBattle = null;
    state.tacData = null;
    state.shingariActive = false;
    state.battleFlags = { guaranteeHit: false, transformCrit: false, guaranteeDodge: false, counterActive: false, statBuff: 0, earnedMoney: 0, earnedExp: 0, resUpShock: false, resUpElec: false, scoutedList: [] };
    if (typeof closeSub === 'function') closeSub(); // コマンドメニュー閉じる
    document.querySelectorAll(".recoil-damage-preview").forEach(el => el.remove()); // 反動プレビューの赤枠を消す
    document.querySelectorAll(".hit-popup").forEach(el => el.remove()); // HIT等のポップアップを消す
    // システム設定のデフォルト
    state.enableLevelUp = true; state.enableResistance = false; state.enableAttribute = false;
    state.enableStatus = true; // 🌟 追加
    state.enablePartyBattle = false; state.enableAnalyze = true; state.enableEscape = true;
    state.enableScout = true; state.enableTimeSystem = true; state.enablePermaDeath = false;
    state.enableSpReset = true; state.enableMultiEquip = false; state.enableTactical = false;
    state.enableTension = false;
    state.inBattle = false;
    state.isPrepPhase = false;
    state.maxLevel = 0; state.maxItemCount = 0; state.maxSkills = 0; state.skipHitDice = false;
    state.maxPlayerCount = 50; state.battleMemberCount = 3; state.maxEquipCount = 1;
    state.maxPartyCost = 0; state.timeLimit = 0; state.turnLimit = 0;

    // 演出フラグのリセット
    state.customBg = null; state.customTextColor = null;
    state.customMsgBg = null; state.customMsgText = null; state.customMsgSpeaker = null;
    messageLog = [];

    // 3. UIの強制非表示・リセット
    const elementsToHide = ["story-choices", "story-dice-area", "dice-board", "battle-cutin", "timer-display", "pvp-timer-display", "warning-layer"];
    elementsToHide.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });

    document.querySelector(".app-container").style.pointerEvents = "auto";

    const storyView = document.getElementById("view-story");
    if (storyView) storyView.style.background = "linear-gradient(to bottom, #ebf8ff, #bee3f8)";
    const storyAA = document.getElementById("story-aa");
    if (storyAA) storyAA.style.color = "#1a202c";

    const msgBox = document.getElementById("story-message-box");
    if (msgBox) { msgBox.style.backgroundColor = "rgba(0,0,0,0.85)"; msgBox.style.color = "#ffffff"; }
    const speakerLabel = document.getElementById("story-speaker");
    if (speakerLabel) { speakerLabel.style.color = "#ecc94b"; }
};
window.releaseActionGame = function (e) {
    if (e && e.cancelable) e.preventDefault();
    // 余韻のフラグ管理は自動化されたので、ここでは特に何もしない
};

// ==========================================
// 🧩 簡易パズル（ブロック落とし）用 ロジック
// ==========================================
function initTetrisGrid() {
    agState.tetrisGrid = Array(agState.tHeight).fill().map(() => Array(agState.tWidth).fill(0));
    agState.tPieceShape = null; // 初期化
    drawTetrisGrid();
}

function drawTetrisGrid() {
    const gridEl = document.getElementById("ag-tetris-grid");
    if (!gridEl) return;

    // 🌟 修正：サイズを25pxに合わせる
    gridEl.style.gridTemplateRows = `repeat(${agState.tHeight}, 20px)`;
    gridEl.style.gridTemplateColumns = `repeat(${agState.tWidth}, 20px)`;
    gridEl.innerHTML = "";

    for (let y = 0; y < agState.tHeight; y++) {
        for (let x = 0; x < agState.tWidth; x++) {
            // 背景色または固定されたブロックの色
            let color = agState.tetrisGrid[y][x] ? "#38a169" : "#2d3748";

            // 🌟 修正：落下中のブロックの形状を読み取って色を塗る
            if (agState.tPieceShape) {
                let px = x - agState.tPieceX;
                let py = y - agState.tPieceY;
                // ブロックの設計図の範囲内であり、かつ「1（ブロックがある）」マスなら色を塗る
                if (py >= 0 && py < agState.tPieceShape.length && px >= 0 && px < agState.tPieceShape[0].length) {
                    if (agState.tPieceShape[py][px] === 1) {
                        color = agState.tPieceColor;
                    }
                }
            }

            let cell = document.createElement("div");
            // 🌟 修正：マスの幅と高さも25pxに指定
            cell.style.cssText = `width:20px; height:20px; background:${color}; border-radius:2px; border:1px solid rgba(0,0,0,0.3); box-sizing:border-box;`;
            gridEl.appendChild(cell);
        }
    }
}

// 🌟 当たり判定（壁や他のブロックにめり込んでいないかチェック）
function checkTetrisCollision(nx, ny, shape) {
    if (!shape) return false;
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[0].length; x++) {
            if (shape[y][x] === 1) {
                let gx = nx + x;
                let gy = ny + y;
                // 画面の左右・下にはみ出したか、すでにブロックがある場所に重なった場合は「衝突（true）」
                if (gx < 0 || gx >= agState.tWidth || gy >= agState.tHeight || (gy >= 0 && agState.tetrisGrid[gy][gx])) {
                    return true;
                }
            }
        }
    }
    return false; // どこにもぶつからなかった
}

function spawnTetrisPiece() {
    // ランダムな形を選ぶ
    let rand = TETRIS_SHAPES[Math.floor(Math.random() * TETRIS_SHAPES.length)];
    agState.tPieceShape = rand.shape;
    agState.tPieceColor = rand.color;

    // 真ん中から出現させる
    agState.tPieceX = Math.floor((agState.tWidth - agState.tPieceShape[0].length) / 2);
    agState.tPieceY = 0;

    // 出た瞬間にぶつかっていたらゲームオーバー（溢れた）
    if (checkTetrisCollision(agState.tPieceX, agState.tPieceY, agState.tPieceShape)) {
        finishActionGame(false, "ブロックが溢れた！");
    }
    drawTetrisGrid();
}

window.moveTetris = function (dx) {
    if (!agState.isPlaying || agState.step.gameType !== "tetris") return;

    // 動かした先でぶつからないかチェックしてから移動
    if (!checkTetrisCollision(agState.tPieceX + dx, agState.tPieceY, agState.tPieceShape)) {
        agState.tPieceX += dx;
        drawTetrisGrid();
    }
};

window.dropTetris = function () {
    if (!agState.isPlaying || agState.step.gameType !== "tetris") return;

    // 下にぶつかるまで一気にY座標を増やす（ハードドロップ）
    while (!checkTetrisCollision(agState.tPieceX, agState.tPieceY + 1, agState.tPieceShape)) {
        agState.tPieceY++;
    }
    tickTetris(); // 着地処理へ
};

function tickTetris() {
    if (!agState.isPlaying) return;

    // 1マス下にぶつからないかチェック
    if (!checkTetrisCollision(agState.tPieceX, agState.tPieceY + 1, agState.tPieceShape)) {
        agState.tPieceY++;
    } else {
        // 🌟 ぶつかった場合：盤面にブロックを焼き付ける
        for (let y = 0; y < agState.tPieceShape.length; y++) {
            for (let x = 0; x < agState.tPieceShape[0].length; x++) {
                if (agState.tPieceShape[y][x] === 1) {
                    let gy = agState.tPieceY + y;
                    let gx = agState.tPieceX + x;
                    if (gy >= 0 && gy < agState.tHeight && gx >= 0 && gx < agState.tWidth) {
                        agState.tetrisGrid[gy][gx] = 1; // 盤面データに「1(ブロックあり)」を記録
                    }
                }
            }
        }
        checkTetrisLines();
        spawnTetrisPiece();
    }
    drawTetrisGrid();
}

function checkTetrisLines() {
    let newGrid = agState.tetrisGrid.filter(row => row.some(cell => cell === 0));
    let linesCleared = agState.tHeight - newGrid.length;

    if (linesCleared > 0) {
        agState.tTargetLines = Math.max(0, agState.tTargetLines - linesCleared);
        document.getElementById("ag-msg").innerText = `目標: 残り ${agState.tTargetLines} ライン`;
        while (newGrid.length < agState.tHeight) {
            newGrid.unshift(Array(agState.tWidth).fill(0));
        }
        agState.tetrisGrid = newGrid;

        if (agState.tTargetLines <= 0) {
            finishActionGame(true, "目標ライン達成！");
        }
    }
}
// 🌟 特性「わざわい」の一斉発動処理
window.triggerOmenTrait = async function () {
    let memberLimit = state.battleMemberCount || 3;
    let omens = [];

    state.player.slice(0, memberLimit).forEach((p, idx) => {
        if (p.hp > 0 && p.trait === "omen") omens.push({ char: p, isPlayer: true, idx: idx });
    });
    state.enemy.forEach((e, idx) => {
        if (e.hp > 0 && e.trait === "omen") omens.push({ char: e, isPlayer: false, idx: idx });
    });

    if (omens.length === 0) return;

    // 🌟 修正：味方優先を排除。熟練度（tech+exp）順に並べ替える（同値は乱数）
    omens.sort((a, b) => {
        let aStats = getStats(a.char, a.isPlayer);
        let bStats = getStats(b.char, b.isPlayer);
        let diff = (bStats.tech + bStats.exp) - (aStats.tech + aStats.exp);
        return diff !== 0 ? diff : (uiRandom() < 0.5 ? -1 : 1);
    });

    let triggered = false;

    // 強い順に発動させる
    omens.forEach(o => {
        let targets = o.isPlayer ? state.enemy : state.player.slice(0, memberLimit);
        targets.forEach((t, tIdx) => {
            if (t.hp <= 0) return;
            let hash = (o.char.name.length + t.name.length + o.idx + tIdx + state.turnCount) % 3;
            if (hash === 0) t.curShock = Math.floor(t.curShock / 2);
            else if (hash === 1) t.curHeat = Math.floor(t.curHeat / 2);
            else t.curElec = Math.floor(t.curElec / 2);
        });
        triggered = true;
    });

    if (triggered) {
        await showMsg(`<span style="color:#805ad5; font-weight:bold;">【わざわい】 禍々しい気配により 誰かの耐性が半分になった！</span>`);
        playGlitchEffect();
        updateUI();
    }
}
// ==========================================
// 💀 死亡時の判定（タクティカル復帰用の上書き）
// ==========================================
async function checkDead() {
    [...state.player, ...state.enemy].forEach(c => { if (c) c.tempEmotion = null; });
    await updateUI();
    
    for (let i = 0; i < state.enemy.length; i++) {
        let en = state.enemy[i];
        if (en && en.hp <= 0 && en.death_scene && SCENARIO[en.death_scene]) {
            en.hp = 1; en.death_scene = "";
            isSkipping = false; await showMsg(`【イベント発生】 ${en.name} に 何かが起きた！`); 
            state.isAnimating = false; saveGame(); jumpTo(en.death_scene); return true;
        }
    }

    for (let i = 0; i < state.player.length; i++) {
        let pl = state.player[i];
        if (pl && pl.hp <= 0 && pl.death_scene && SCENARIO[pl.death_scene]) {
            pl.hp = 1; pl.death_scene = "";
            isSkipping = false; await showMsg(`【イベント発生】 ${pl.name} に 致命傷！！\nしかし……！？`);
            state.isAnimating = false; saveGame(); jumpTo(pl.death_scene); return true;
        }
    }

    const p = state.player[state.activeP], e = state.enemy[state.activeE];
    let pAlive = state.player.some(pl => pl && pl.hp > 0);
    let eAlive = state.enemy.some(en => en && en.hp > 0);

    // 1vs1のタクティカル決闘中なら盤面へ帰る！
    if (state.tacData) {
        if (!pAlive || !eAlive) {
            state.isAnimating = false;
            await returnToTacticalBoard(p, e);
            return true;
        }
        return false; 
    }

    // 🌟 修正：敵を倒した処理(e.hp <= 0)より先に、相打ちの処理を済ませてしまう
    if (!pAlive && !eAlive) {
        await showMsg(`<span style="color:#805ad5; font-size:24px;">【相打ち】</span><br>おたがいに 力尽きたお……`);
        if (state.isPvP) { endPvP(); return true; }
        state.tacData = null;
        jumpTo(state.battleDrawNext || state.battleLoseNext);
        return true;
    }

    if (e && e.hp <= 0) {
        await showMsg(`${e.name} を たおした！`);
        await wait(800); 
        state.battleFlags.earnedMoney += (e.dropMoney || 0);
        state.battleFlags.earnedExp += (e.dropExp || 0);

        // 🌟 修正：タクティカル盤面バトルの場合
        // 以前は `state.tacData && document.getElementById("view-tactical")` と書いていましたが、
        // 決闘中は "view-battle" に切り替わっているため、これだと分岐に入れませんでした！
        // 純粋に `state.tacData` が存在しているかどうかだけで判定します。
        
        if (state.tacData) {
            if (state.isPvP && conn) {
                conn.send({ type: 'TAC_ESCAPE_SUCCESS' }); // 逃走じゃなく死亡扱いとして送信
            }

            state.isAnimating = false;
            // 盤面へ戻る（この戻った先で本当の全滅判定が行われます）
            await returnToTacticalBoard(p, e);
            return true; 
        }

        // --- 以下、通常のバトル（1vs1 / パーティ）の処理 ---
        state.activeE++;
        if (state.activeE >= state.enemy.length) {
            state.money = Math.min(99999999, state.money + state.battleFlags.earnedMoney);
            await showMsg(`たたかいに 勝ったお！\n${state.battleFlags.earnedMoney} G を手に入れた！`);
            await wait(800);
            if (state.enableLevelUp && state.battleFlags.earnedExp > 0) {
                const originalP = state.activeP;
                for (let i = 0; i < state.player.length; i++) {
                    const pChar = state.player[i];
                    if (pChar && pChar.hp > 0) {
                        pChar.levelExp += state.battleFlags.earnedExp;
                        if (i < (state.battleMemberCount || 3)) { state.activeP = i; await updateUI(); }
                        await checkLevelUp(pChar);
                    }
                }
                state.activeP = originalP; updateUI();
            }
            state.isAnimating = false;
            openResultScreen(state.battleFlags.earnedMoney, state.battleFlags.earnedExp);
            return true;
        } else {
            // 次鋒登場
            state.enemy[state.activeE].isFirstTurn = true;
            state.enemy[state.activeE].turnInBattle = 0;
            state.enemy[state.activeE].tension = 0;
            
            // 🌟 修正：ここも同様に、タクティカルの決闘中（state.tacDataが存在する時）は「わざわい」を禁止する！
            if (state.enemy[state.activeE].trait === "omen" && !state.tacData) {
                let targetPlayers = state.enablePartyBattle ? state.player.slice(0, state.battleMemberCount || 3).filter(pl => pl.hp > 0) : [state.player[state.activeP]];
                targetPlayers.forEach(pl => {
                    const r = Math.floor(Math.random() * 3);
                    if (r === 0) pl.curShock = Math.floor(pl.curShock / 2);
                    else if (r === 1) pl.curHeat = Math.floor(pl.curHeat / 2);
                    else pl.curElec = Math.floor(pl.curElec / 2);
                });
                await showMsg(`【わざわい】 新たに現れた ${state.enemy[state.activeE].name} の 禍々しい気配で 耐性が削られた！`);
                playGlitchEffect();
            }
            updateUI();
            await showMsg(`あ！ ${state.enemy[state.activeE].name} が あらわれた！`);
            await wait(800);
            state.isAnimating = false;
            return true;
        }
    }

    // 味方が死んだ時
    if (p && p.hp <= 0) {
        await showMsg(`${p.name} は たおれた！`);

        // 🌟 タクティカル盤面復帰（敵が勝った場合）
        // ここでも絶対に true を返す！
        if (state.tacData && document.getElementById("view-tactical")) {
            state.tacData.turn = "enemy";
            e.hasActed = true; 
            state.isAnimating = false;
            await returnToTacticalBoard(p, e);
            return true;
        }

        // 以下、通常バトルの処理
        const next = state.player.findIndex(x => x && x.hp > 0);
        if (next === -1) {
            state.isAnimating = false;
            if (state.battleLoseNext) {
                state.player.forEach(char => { if (char && char.hp <= 0) char.hp = 1; });
                jumpTo(state.battleLoseNext);
            } else {
                await showMsg(`めのまえが まっくらになった……`);
                if (state.isTestPlay) { alert("テスト終了"); state.isTestPlay = false; changeView("view-editor"); }
                else { 
                    // 🌟 修正：タイトルへ戻る前に完全初期化を行う
                    cleanupGameState();
                    await checkSaveData(); 
                    changeView("view-title"); 
                }
            }
            return true;
        } else {
            state.activeP = next;
            state.player[next].isFirstTurn = true;
            state.player[next].turnInBattle = 0;
            state.player[next].tension = 0;
            if (state.player[next].trait === "omen") {
                let targetEnemies = state.enablePartyBattle ? state.enemy.filter(en => en.hp > 0) : [state.enemy[state.activeE]];
                targetEnemies.forEach(en => {
                    const r = Math.floor(Math.random() * 3);
                    if (r === 0) en.curShock = Math.floor(en.curShock / 2);
                    else if (r === 1) en.curHeat = Math.floor(en.curHeat / 2);
                    else en.curElec = Math.floor(en.curElec / 2);
                });
                await showMsg(`【わざわい】 ${state.player[next].name} が 場に現れたことで 相手の耐性が削られた！`);
                playGlitchEffect();
            }
            updateUI();
            await showMsg(`ゆけっ！ ${state.player[next].name}！`);
            state.isAnimating = false;
            return true;
        }
    }

    if (state.isAnimating) {
        await showMsg(`どうする？`);
        updateUI();
        state.isAnimating = false;
        startTurnTimer();
        setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 100);
    }
    return false;
}
// 🏃‍♂️ 逃走成功時の統一処理（PvP・タクティカル・通常すべて対応）
window.processEscapeSuccess = async function (p, e) {
    state.isAnimating = false;
    saveGame();

    // 1. PvP（対人戦）の場合は即座に降参扱い
    if (state.isPvP) {
        await showMsg(`白旗をあげた！\nあなたの 敗北 です。`);
        if (conn) conn.send({ type: 'PVP_GAME_OVER', result: '対戦相手がギブアップしました' });
        endPvP();
        return;
    }

    // 2. 特性：しんがりの処理
    if (p.trait === "rearguard" && state.player.includes(p)) {
        state.shingariActive = true; 
        await showMsg(`【しんがり】 ${p.name} が殿を務め、残された味方の攻防がアップした！`);
        updateUI();
    }

    // 3. タクティカル盤面での逃走（元の位置に戻る）
    if (state.tacData && document.getElementById("view-tactical").classList.contains("active")) {
        state.tacData.turn = "player";
        state.tacData.selectedUnit = null;
        state.tacData.movedUnit = null;
        state.tacData.hasEscapedThisRound = true; // 背水の陣（同ターン逃走禁止）

        p.hasActed = false;
        p.justEscaped = true; // 再攻撃禁止

        if (p.prevX !== undefined && p.prevY !== undefined) {
            p.x = p.prevX; p.y = p.prevY;
        }

        await returnToTacticalBoard(p, e);
        return;
    }

    // 4. 通常のシナリオバトルの逃走
    if (state.battleFlags.scoutedList && state.battleFlags.scoutedList.length > 0) {
        state.battleWinNext = state.battleEscapeNext;
        openResultScreen(0, 0);
    } else {
        jumpTo(state.battleEscapeNext);
    }
};
// ==========================================
// ⚔️ タクティカル盤面への復帰・操作権管理
// ==========================================
window.returnToTacticalBoard = async function (attacker, defender) {
    state.isAnimating = false;
    isSkipping = false;
    if (typeof clearCellHighlights === "function") clearCellHighlights();

    // 乱入バトル用に絞り込んでいたメンバーを、元の全体リストに戻す
    if (state.tacData.backupPlayer) {
        state.player = state.tacData.backupPlayer;
        state.tacData.backupPlayer = null;
    }
    if (state.tacData.backupEnemy) {
        state.enemy = state.tacData.backupEnemy;
        state.tacData.backupEnemy = null;
    }

    // 🌟 追加：決闘が終わったので、一時的なフラグ「だけ」を掃除する。
    // HP、状態異常、テンション、耐性ブレイクは「残す」！
    [...state.player, ...state.enemy].forEach(c => {
        if (c && c.hp > 0) {
            c.guaranteeHit = false;
            c.transformCrit = false;
            c.guaranteeDodge = false;
            c.counterActive = false;
            c.hasDoubleStrike = false;
            c.hasBeenCountered = false;
            c.isFirstTurn = true; // 次の決闘では再び1ターン目扱い
            c.turnInBattle = 0;
            // 🚨 注：c.status や c.tension は絶対にリセットしない！
        }
    });

    const container = document.querySelector(".app-container");
    if (container) container.style.pointerEvents = "auto";
    const boardContainer = document.getElementById("tac-board-container");
    if (boardContainer) {
        boardContainer.style.pointerEvents = "auto";
        boardContainer.style.opacity = "1";
    }

    if (state.isPvP && typeof conn !== "undefined" && conn) {
        conn.send({
            type: 'TAC_SYNC_STATUS',
            attackerId: attacker.id,
            aHp: attacker.hp, aStatus: attacker.status, aStatusTurn: attacker.statusTurn,
            aTension: attacker.tension,
            aShock: attacker.curShock, aHeat: attacker.curHeat, aElec: attacker.curElec,
            defenderId: defender.id,
            dHp: defender.hp, dStatus: defender.status, dStatusTurn: defender.statusTurn,
            dTension: defender.tension,
            dShock: defender.curShock, dHeat: defender.curHeat, dElec: defender.curElec
        });
    }

    if (await checkTacticalDead()) return;

    changeView("view-tactical");

    // 操作権の適用とUIの更新
    if (state.tacData.turn === "enemy") {
        showToast("敵が操作権を得た！", "warning");
        if (state.isPvP) {
            showToast("相手の行動を待っています...", "info");
        } else {
            startEnemyTacticalTurn(); // ソロなら敵のAIを動かす
        }
    } else {
        showToast("プレイヤーが操作権を得た！", "info");
        updateTacticalUI();
        checkTacticalTurnEnd(); // 全員行動済みかチェック
    }
};
// ==========================================
// ⚔️ タクティカル決闘（周囲2マス乱入システム）
// ==========================================
// ==========================================
// ⚔️ タクティカル決闘（周囲2マス乱入システム）
// ==========================================
window.startTacticalDuel = async function (attacker, defender, isSupport = false, duelPIds = null, duelEIds = null) {
    state.isAnimating = true;
    isSkipping = false;

    let isPlayerAttack = state.player.includes(attacker);
    let duelPlayers = [];
    let duelEnemies = [];

    // パーティバトルOFFなら乱入させない（最大1人）
    const maxDuelMembers = state.enablePartyBattle ? (state.battleMemberCount || 3) : 1;

    if (duelPIds && duelEIds) {
        duelPlayers = duelPIds.map(id => state.player.find(p => p.id === id)).filter(p => p).slice(0, maxDuelMembers);
        duelEnemies = duelEIds.map(id => state.enemy.find(e => e.id === id)).filter(e => e).slice(0, maxDuelMembers);
    } else {
        const cx = attacker.x; const cy = attacker.y;
        const getUnitsInRange = (team, maxRange) => team.filter(u => u.hp > 0 && u.x !== undefined && (Math.abs(u.x - cx) + Math.abs(u.y - cy)) <= maxRange);

        if (isPlayerAttack) {
            duelPlayers = [attacker, ...getUnitsInRange(state.player, 2).filter(p => p !== attacker)].slice(0, maxDuelMembers);
            duelEnemies = [defender, ...getUnitsInRange(state.enemy, 2).filter(e => e !== defender)].slice(0, maxDuelMembers);
        } else {
            duelEnemies = [attacker, ...getUnitsInRange(state.enemy, 2).filter(e => e !== attacker)].slice(0, maxDuelMembers);
            duelPlayers = [defender, ...getUnitsInRange(state.player, 2).filter(p => p !== defender)].slice(0, maxDuelMembers);
        }
    }

    state.tacData.backupPlayer = state.player;
    state.tacData.backupEnemy = state.enemy;
    state.player = duelPlayers;
    state.enemy = duelEnemies;
    state.activeP = 0;
    state.activeE = 0;
 [...state.player, ...state.enemy].forEach(c => {
        if (c) c.turnDice = undefined;
    });
    document.getElementById("view-tactical").classList.remove("active");
    changeView("view-battle");
    updateUI();

    let pCount = duelPlayers.length;
    let eCount = duelEnemies.length;

    // 🌟 修正：サポートモードのメッセージと分岐を完全削除
    if (pCount > 1 || eCount > 1) {
        showToast(`⚔️ 周囲の仲間が乱入！ ${pCount} vs ${eCount} の乱戦が始まった！`, "danger");
    } else {
        showToast(`⚔️ ${attacker.name} が ${defender.name} と戦闘に入った！`, "info");
    }

    if (state.enablePartyBattle) {
        state.partyBattle = { phase: 'command', currentActorIdx: -1, actions: [] };
        state.isAnimating = false;
        nextPartyCommand(); 
        return;
    } else {
        // 1対1（システムOFFの場合のタイマン用UI）
        if (isPlayerAttack) {
            await showMsg(`＞＞ あなたの先制攻撃！ 行動を選んでください ＜＜`);
            state.isAnimating = false;
            setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 100);
        } else {
            await showMsg(`＞＞ 敵の先制攻撃！ ＜＜`);
            let eSkillId = getEnemyAction(attacker);
            let skill = (eSkillId === "normal" || eSkillId === "nothing") ? null : SKILLS[eSkillId];

            if (skill && skill !== "nothing") {
                await executeAttackSequence(attacker, [defender], skill, false);
            } else {
                await showMsg(`${attacker.name} は 様子を見ている……`);
            }

            let isDead = await checkDead();
            if (isDead) return;

            await showMsg(`どうする？`);
            state.isAnimating = false;
            setTimeout(() => { const btn = document.getElementById("btn-attack"); if (btn) btn.focus(); }, 100);
        }
    }
};
// 🌟 追加：時間経過を安全に処理する共通関数
window.advanceTime = function (amount) {
    state.timePeriod += amount;

    // 未来へ（日数をまたぐ）
    while (state.timePeriod > 3) {
        state.timePeriod -= 4;
        state.day++;
    }
    // 過去へ（前日の夜に戻る）
    while (state.timePeriod < 0) {
        state.timePeriod += 4;
        state.day--;
    }

    // UIを更新
    if (typeof updateTimeUI === 'function') updateTimeUI();
};
// 戻り値: { isDead: boolean, actualDmg: number }
window.applyDamage = async function (attacker, defender, rawDamage, isPlayerAttack, isInstaKill = false) {
    let currentDefTrait = defender.trait || "none";
    let isSturdyActivated = false;
    let actualDmg = rawDamage;

    // --- ダメージ軽減・無効化の事前処理 ---
    if (defender.status === "invincible") actualDmg = 0;
    else if (currentDefTrait === "metal_body") actualDmg = 1;
    else if (currentDefTrait === "gamble_body" && Math.random() < 0.5) {
        actualDmg = 0;
        await showMsg(`【ギャンブル】 ${defender.name} は 運良くダメージを免れた！`);
    }
    else if (currentDefTrait === "hard_body" && actualDmg > 0) {
        actualDmg = Math.max(1, Math.floor(actualDmg / 3));
    }

    // --- ダメージ適用 ---
    if (isInstaKill) {
        // とどめ（即死）処理
        if (currentDefTrait === "sturdy" && defender.hp === defender.maxHp) {
            actualDmg = defender.hp - 1;
            defender.hp = 1;
            isSturdyActivated = true;
        } else if (defender.isBoss === "true") {
            // ボスは即死しないが通常ダメージは入る
            defender.hp = Math.max(0, defender.hp - actualDmg);
        } else {
            actualDmg = defender.hp;
            defender.hp = 0;
        }
    } else {
        // 通常ダメージ処理
        if (currentDefTrait === "sturdy" && defender.hp === defender.maxHp && actualDmg >= defender.hp) {
            actualDmg = defender.hp - 1;
            isSturdyActivated = true;
        }
        defender.hp = Math.max(0, defender.hp - actualDmg);
    }

    // --- メッセージ表示 ---
    if (actualDmg > 0) {
        defender.tempEmotion = "ダメージ";
        await updateUI();
        resizeAllAAs(); // 🌟 追加：ダメージ顔になった瞬間にリサイズ！
        await showMsg(`${defender.name} に ${actualDmg} の ダメージ！`);
        if (isSturdyActivated) { await showMsg(`${defender.name} の がんじょう が発動！`); }
    }

    // --- 死亡時（HP0）の共通処理 ---
    if (defender.hp <= 0) {
        // くじけぬ心
        if (currentDefTrait === "unyielding_heart" && Math.random() < 0.3) {
            defender.hp = 1;
            await showMsg(`【くじけぬ心】 ${defender.name} は 倒れる寸前で 踏みとどまった！`);
            updateUI();
            return { isDead: false, actualDmg: actualDmg };
        }

        // オート装備消費（食いしばり）
        let eqList = Array.isArray(defender.equips) ? defender.equips : (defender.equip ? [defender.equip] : []);
        let triggeredItemId = eqList.find(eid => eid && ITEMS[eid] && ITEMS[eid].auto_trigger === "on_death");
        if (triggeredItemId) {
            defender.hp = 1;
            consumeEquipItem(defender, triggeredItemId);
            await showMsg(`【オート】${defender.name} は ${ITEMS[triggeredItemId].name} で 持ちこたえた！`);
            updateUI();
            return { isDead: false, actualDmg: actualDmg };
        }

        // ラストバースト（自爆）
        if (currentDefTrait === "last_burst" && !defender.hasBursted) {
            defender.hasBursted = true; // 🌟 追加：二重発動（無限ループ）防止フラグ
            let burstDmg = Math.max(1, Math.floor(defender.maxHp * 0.5));
            let burstTargets = isPlayerAttack ? state.player.slice(0, state.battleMemberCount || 3) : state.enemy;

            await showMsg(`【ラストバースト】 ${defender.name} の 最後の力が 爆発した！！`);

            let hitAnyone = false;
            for (let t of burstTargets) {
                if (t.hp > 0) {
                    // 自爆ダメージも再帰的に applyDamage を呼ぶことで連鎖自爆や食いしばりを処理できる
                    await applyDamage(defender, t, burstDmg, state.player.includes(t), false);
                    hitAnyone = true;
                }
            }
            if (hitAnyone) {
                await showMsg(`大爆発により 相手パーティ全体に ${burstDmg} のダメージ！`);
                playGlitchEffect(); updateUI();
            }
        }

        return { isDead: true, actualDmg: actualDmg };
    }
    if (actualDmg > 0 && attacker.hp > 0 && !attacker.hasBeenCountered) {
        let counterDmg = 0;
        let counterName = "";

        if (currentDefTrait === "counter_strike") {
            counterDmg = Math.max(1, Math.floor((defender.baseDmg || 0) / 2));
            counterName = "カウンター";
        } else if (currentDefTrait === "reflector") {
            counterDmg = Math.max(1, Math.floor((defender.baseDef || 0) / 2));
            counterName = "リフレクター";
        }

        if (counterDmg > 0) {
            attacker.hp = Math.max(0, attacker.hp - counterDmg);
            attacker.hasBeenCountered = true; // 🌟 追加：この攻撃中はもう反撃を受けない
            await showMsg(`【${counterName}】 ${defender.name} の反撃！\n${attacker.name} に ${counterDmg} の 固定ダメージ！`);
            updateUI();
        }
    }

    return { isDead: false, actualDmg: actualDmg };
};
window.openMemberManagement = function () {
    state.managementMode = "camp";
    document.getElementById("system-menu-modal").style.display = "none";
    openMemberSelectModal();
};

window.openMemberSelectModal = function () {
    const modal = document.getElementById("grow-modal");
    modal.style.display = "flex";

    // 🌟 最重要修正：クリックロックを強制解除する！
    modal.style.pointerEvents = "auto";

    const spContainer = document.getElementById("grow-sp-container");
    if (spContainer) spContainer.style.display = "none";

    // タイトルの青い線も念のためJS側でも消しておく
    document.getElementById("grow-title").style.borderBottom = "none";
    document.getElementById("grow-title").innerText = "管理するキャラを選択";

    let html = ``;
    state.player.forEach((p, i) => {
        const isBench = i >= (state.battleMemberCount || 3) ? " <small>(控え)</small>" : "";
        const pStats = getStats(p, true);
        html += `
            <button class="btn-choice w-100 mb-2" onclick="openGrowModal(${i})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span><b>${p.name}</b> Lv.${p.level}${isBench}</span>
                    <span style="font-size:11px; color:#718096;">HP:${p.hp}/${p.maxHp} 技:${pStats.tech} 経:${pStats.exp}</span>
                </div>
            </button>`;
    });

    document.getElementById("grow-list").innerHTML = html;

    const footer = document.getElementById("grow-footer");
    if (footer) {
        footer.style.display = "block";
        footer.innerHTML = `<button class="btn-cancel w-100" style="padding:15px; font-size:15px;" onclick="returnToSystemMenu()">システムメニューに戻る</button>`;
    }
};
const originalOpenGrowModal = window.openGrowModal;
window.openGrowModal = function (charIdx) {
    if (state.managementMode !== "camp") state.managementMode = "prep";

    const modal = document.getElementById("grow-modal");
    modal.style.display = "flex";
    modal.style.pointerEvents = "auto";
    document.getElementById("grow-title").style.borderBottom = "2px solid var(--primary)";

    const p = state.player[charIdx];
    growState.charIdx = charIdx;
    growState.tempSp = p.sp || 0;
    growState.tempStats = {};
    GROW_MENU.forEach(menu => { growState.tempStats[menu.key] = 0; });

    renderGrowModal();

    const spContainer = document.getElementById("grow-sp-container");
    if (spContainer) spContainer.style.display = "block";

    appendEquipChangeButton(charIdx);

    const footer = document.getElementById("grow-footer");
    const backAction = (state.managementMode === "camp") ? "openMemberSelectModal()" : "closeGrowModal()";

    if (footer) {
        // 🌟 追加：エディタで設定されていればリセットボタンを出す
        let resetBtn = state.enableSpReset ? `<button class="btn-warning w-100" onclick="resetGrow()">🔄 リセット</button>` : "";

        footer.style.display = "flex";
        footer.style.gap = "5px";
        footer.innerHTML = `
            ${resetBtn}
            <button class="btn-primary w-100" onclick="confirmGrow()">確定</button>
            <button class="btn-cancel w-100" onclick="${backAction}">戻る</button>
        `;
    }
};

function appendEquipChangeButton(charIdx) {
    const growList = document.getElementById("grow-list");
    const p = state.player[charIdx];

    // すでにあれば消す
    const existing = document.getElementById("camp-equip-container");
    if (existing) existing.remove();

    let eqHtml = `<div id="camp-equip-container" style="margin-top:15px; border-top:2px solid #cbd5e0; padding-top:10px;">
                    <h4 style="color:var(--primary); margin-bottom:5px;">🗡️ 装備変更</h4>`;

    let maxEq = state.maxEquipCount || 1;
    for (let s = 0; s < maxEq; s++) {
        let opts = `<option value="none">-- 装備なし --</option>`;
        
        let availableEquips = [...state.ownedEquips];
        if (p.equips && p.equips[s] && p.equips[s] !== "none") availableEquips.push(p.equips[s]);

        let equipCounts = {};
        availableEquips.forEach(eid => equipCounts[eid] = (equipCounts[eid] || 0) + 1);

        Object.keys(equipCounts).forEach(eid => {
            let myOtherSlotsCount = p.equips ? p.equips.filter((e, eIdx) => eIdx !== s && e === eid).length : 0;
            let isBlockedByRule = (!state.enableMultiEquip && myOtherSlotsCount > 0);
            let currentEquip = Array.isArray(p.equips) ? p.equips[s] : p.equip;
            
            if (!isBlockedByRule || currentEquip === eid) {
                opts += `<option value="${eid}" ${currentEquip === eid ? 'selected' : ''}>${ITEMS[eid].name} (残${equipCounts[eid]})</option>`;
            }
        });
        eqHtml += `<select class="w-100 mb-1" style="font-size:12px;" onchange="changeEquipInCamp(${charIdx}, ${s}, this.value)">${opts}</select>`;
    }
    eqHtml += `</div>`;
    growList.insertAdjacentHTML('beforeend', eqHtml);
}


function checkCondition(currentVal, cond, targetVal) {
    // 🌟 修正：値が存在しない(undefined)場合は数値の 0 として扱う
    if (currentVal === undefined || currentVal === null) {
        currentVal = 0;
    }

    let cIsStr = (typeof currentVal === "string" && currentVal.trim() === "");
    let tIsStr = (typeof targetVal === "string" && targetVal.trim() === "");

    if (!cIsStr && !tIsStr && !isNaN(currentVal) && !isNaN(targetVal)) {
        currentVal = Number(currentVal);
        targetVal = Number(targetVal);
    } else {
        currentVal = String(currentVal);
        targetVal = String(targetVal);
    }

    cond = cond || "==";
    if (cond === "==") return (currentVal == targetVal);
    if (cond === "!=") return (currentVal != targetVal);
    if (cond === ">=") return (currentVal >= targetVal);
    if (cond === "<=") return (currentVal <= targetVal);
    if (cond === ">") return (currentVal > targetVal);
    if (cond === "<") return (currentVal < targetVal);
    return false;
}
// ==========================================
// 🎲 汎用 1d10 ダイス判定UI（攻撃・逃走・スカウト共通）
// ==========================================
window.roll1d10Dice = async function (title, successRate, successText = "成功", failText = "失敗", enableCrit = false) {

    // 🌟 修正：盤面を出す前に、メッセージを先に表示しきる
    if (!state.skipHitDice) {
        await showMsg(`＞＞ ${title}ダイス(1d10) を ふる！ ＜＜`);
    }

    // 文字が出終わったら、ダイスの盤面を表示する
    document.getElementById("dice-battle-ui").style.display = "none";
    document.getElementById("dice-hit-ui").style.display = "block";
    document.getElementById("dice-board").style.display = "block";

    let successThreshold = Math.min(10, Math.max(1, Math.floor(successRate / 10)));

    document.querySelector("#dice-hit-ui .dice-header").innerText = `🎲 ${title} (1d10)`;
    document.getElementById("hd-rate").innerText = `成功率: ${Math.min(100, Math.max(10, successRate))}%`;


    const fullNums = ["１", "２", "３", "４", "５", "６", "７", "８", "９", "１０"];
    let tableHtml = "";

    for (let i = 1; i <= 10; i++) {
        let isTempCrit = enableCrit && (i === 10);
        let isTempHit = isTempCrit || (i <= successThreshold);

        let resultText = ""; let color = "";
        if (isTempCrit) { resultText = `大${successText}`; color = "#e53e3e"; }
        else if (isTempHit) { resultText = successText; color = "#3182ce"; }
        else { resultText = failText; color = "#718096"; }

        tableHtml += `<div id="hd-row-${i}" style="color: ${color}; padding: 0 10px; border: 1px solid transparent; box-sizing: border-box;">${fullNums[i - 1]}．${resultText}</div>`;
    }
    document.getElementById("hd-table").innerHTML = tableHtml;

    const hd = document.getElementById("hd-val");
    hd.className = "d-val mx-auto";

    let roll = 1; let lastRow = null;

    let loopCount = state.skipHitDice ? 0 : 15;

    // 🌟 アニメーション（スキップ時や「超速い」時は一瞬で終わる）
    for (let i = 0; i < loopCount; i++) {
        // もし途中でスキップされたらループを抜ける
        if (isSkipping) break;

        roll = Math.floor(Math.random() * 10) + 1; hd.innerText = roll;
        if (lastRow) { lastRow.style.background = "transparent"; lastRow.style.border = "1px solid transparent"; }
        lastRow = document.getElementById(`hd-row-${roll}`);
        if (lastRow) { lastRow.style.background = "#f6e05e"; lastRow.style.border = "1px solid #d69e2e"; }
        await wait(60); // 🌟 ちょっとゆっくり回す
    }

    // 🌟 最終結果の確定
    roll = Math.floor(Math.random() * 10) + 1;
    hd.innerText = roll;
    if (lastRow) { lastRow.style.background = "transparent"; lastRow.style.border = "1px solid transparent"; }
    lastRow = document.getElementById(`hd-row-${roll}`);
    if (lastRow) { lastRow.style.background = "#f6e05e"; lastRow.style.border = "1px solid #d69e2e"; }

    let isCritResult = enableCrit && (roll === 10);
    let isSuccessResult = isCritResult || (roll <= successThreshold);

    if (isCritResult) hd.classList.add("dice-crit");
    else if (isSuccessResult) hd.classList.add("dice-winner");

    // 🌟 ここを追加！：結果が確定したらスキップ状態を強制解除し、結果を確実に見せる！
    isSkipping = false;
await wait(800); 

   
document.getElementById("dice-board").style.display = "none";
    return { roll: roll, isSuccess: isSuccessResult, isCrit: isCritResult };
};

window.hydrateData = function (data) {
    if (!data) return data;

    // 🌟 1. グローバルリソースの保護
    data.money = Math.max(0, Math.min(99999999, Number(data.money) || 0));
    data.orbShinsei = Math.max(0, Math.min(99, Number(data.orbShinsei) || 0));

    // 🌟 2. キャラクター個別の補完ロジック
    const hydrateChar = (c) => {
        if (!c) return;

        // --- A. 限界値(Limits)のデフォルト設定 (計算の土台) ---
        c.limit_maxHp = Number(c.limit_maxHp) || 999;
        c.limit_maxMp = Number(c.limit_maxMp) || 500; // 🌟魔力上限
        c.limit_maxSt = Number(c.limit_maxSt) || 500; // 🌟スタミナ上限
        c.limit_tech = Number(c.limit_tech) || 100;
        c.limit_exp = Number(c.limit_exp) || 100;
        c.limit_baseDmg = Number(c.limit_baseDmg) || 100;
        c.limit_baseDef = Number(c.limit_baseDef) || 80;
        c.limit_maxShock = Number(c.limit_maxShock) || 300;
        c.limit_maxHeat = Number(c.limit_maxHeat) || 300;
        c.limit_maxElec = Number(c.limit_maxElec) || 300;
        c.limit_recShock = Number(c.limit_recShock) || 30;
        c.limit_recHeat = Number(c.limit_recHeat) || 30;
        c.limit_recElec = Number(c.limit_recElec) || 30;
        c.limit_atkShock = Number(c.limit_atkShock) || 100;
        c.limit_atkHeat = Number(c.limit_atkHeat) || 100;
        c.limit_atkElec = Number(c.limit_atkElec) || 100;

        // --- B. 基礎ステータスの数値化とクランプ (限界値内に収める) ---
        const cp = (val, maxVal) => Math.max(0, Math.min(Number(val) || 0, maxVal));
        
        c.maxHp = cp(c.maxHp || 100, c.limit_maxHp);
        c.maxMp = cp(c.maxMp || 50,  c.limit_maxMp); // 🌟魔力最大値
        c.maxSt = cp(c.maxSt || 100, c.limit_maxSt); // 🌟スタミナ最大値
        c.tech = cp(c.tech || 10, c.limit_tech);
        c.exp = cp(c.exp || 0, c.limit_exp);
        c.baseDmg = cp(c.baseDmg || 5, c.limit_baseDmg);
        c.baseDef = cp(c.baseDef || 0, c.limit_baseDef);
        
        c.maxShock = cp(c.maxShock || 50, c.limit_maxShock);
        c.maxHeat = cp(c.maxHeat || 50, c.limit_maxHeat);
        c.maxElec = cp(c.maxElec || 50, c.limit_maxElec);
        c.recShock = cp(c.recShock || 10, c.limit_recShock);
        c.recHeat = cp(c.recHeat || 10, c.limit_recHeat);
        c.recElec = cp(c.recElec || 10, c.limit_recElec);
        c.atkShock = cp(c.atkShock || 0, c.limit_atkShock);
        c.atkHeat = cp(c.atkHeat || 0, c.limit_atkHeat);
        c.atkElec = cp(c.atkElec || 0, c.limit_atkElec);
c.dropItem = c.dropItem || "";
        c.dropRate = Number(c.dropRate) || 0;
        // --- C. 現在値(Resources)の復旧と安全化 ---
        // HPの修復
        if (c.hp === undefined || isNaN(c.hp)) c.hp = c.maxHp;
        c.hp = Math.max(0, Math.min(c.hp, c.maxHp));

        // 🌟 魔力(MP)の修復
        if (c.mp === undefined || isNaN(c.mp)) c.mp = c.maxMp;
        c.mp = Math.max(0, Math.min(c.mp, c.maxMp));

        // 🌟 スタミナ(ST)の修復
        if (c.st === undefined || isNaN(c.st)) c.st = c.maxSt;
        c.st = Math.max(0, Math.min(c.st, c.maxSt));

        // 耐性現在値の修復
        if (c.curShock === undefined || isNaN(c.curShock)) c.curShock = c.maxShock;
        if (c.curHeat === undefined || isNaN(c.curHeat)) c.curHeat = c.maxHeat;
        if (c.curElec === undefined || isNaN(c.curElec)) c.curElec = c.maxElec;
        c.curShock = Math.min(c.curShock, c.maxShock);
        c.curHeat = Math.min(c.curHeat, c.maxHeat);
        c.curElec = Math.min(c.curElec, c.maxElec);

        // --- D. その他の属性・フラグの補完 ---
        c.level = Number(c.level) || 1;
        c.levelExp = Number(c.levelExp) || 0;
        c.sp = Number(c.sp) || 0;
        c.revShock = Number(c.revShock) || 2;
        c.revHeat = Number(c.revHeat) || 2;
        c.revElec = Number(c.revElec) || 2;
        
        c.status = c.status || "none";
        c.statusTurn = Number(c.statusTurn) || 0;
        c.statBuff = Number(c.statBuff) || 0;
        c.tension = Number(c.tension) || 0;
        c.trait = c.trait || "none";

        // 属性相性の初期化
        const ATTRS =["fire", "elec", "ice", "wind", "water", "earth", "bomb", "dark", "wave", "light", "mystic", "spirit", "gravity", "fight", "grass"];
        ATTRS.forEach(attr => { c[`aff_${attr}`] = c[`aff_${attr}`] || "nm"; });

        // 配列データの保証
        if (!Array.isArray(c.skills)) c.skills =[];
        if (!Array.isArray(c.equips)) {
            c.equips = (c.equip && c.equip !== "none") ? [c.equip] :[];
        }
        if (!c.growStats) c.growStats = {};
    };

    // 🌟 3. 各データ群への適用
    if (data.player || data.PLAYER_TEAM) {
        const team = data.player || data.PLAYER_TEAM;
        if (team.length === 0) {
            team.push({ id: "hero", name: "主人公", maxHp: 100, hp: 100, tech: 10, exp: 0, baseDmg: 5, baseDef: 0, aa: "CHARACTER.ORIGINAL.YARUO.normal" });
        }
        team.forEach(p => hydrateChar(p));
    }

    const fixEnemyAA = (e) => {
        hydrateChar(e);
        if (!e.aa || e.aa === "" || e.aa === '{"通常":""}') {
            let baseId = e.originalId || e.id.split('_')[0];
            let masterData = typeof ENEMY_MASTER !== 'undefined' ? ENEMY_MASTER[baseId] : null;
            if (masterData && masterData.aa) {
                e.aa = masterData.aa;
            }
        }
    };

    if (data.enemy) data.enemy.forEach(e => fixEnemyAA(e));
    if (data.ENEMY_MASTER) Object.values(data.ENEMY_MASTER).forEach(e => fixEnemyAA(e));

    // 🌟 4. アイテムデータの補完
    // 🌟 4. アイテムデータの補完
    if (data.ITEMS) {
        Object.values(data.ITEMS).forEach(i => {
            i.type = i.type || "consumable";
            i.price = Number(i.price) || 0;
            i.effectPower = Number(i.effectPower) || 0;
            i.range = Number(i.range) || 1;

            // 🌟 追加：MP/STの最大値アップを数値として補完
            i.addMaxMp = Number(i.addMaxMp) || 0;
            i.addMaxSt = Number(i.addMaxSt) || 0;

            // 🌟 追加：貴重品フラグを確実に「真(true)か偽(false)」の状態にする
            i.isGlobal = !!i.isGlobal; 

            const ATTRS = ["fire", "elec", "ice", "wind", "water", "earth", "bomb", "dark", "wave", "light", "mystic", "spirit", "gravity", "fight", "grass"];
            ATTRS.forEach(attr => { i[`aff_${attr}`] = i[`aff_${attr}`] || "nm"; });
        });
    }
    // 🌟 5. 技データの補完
    if (data.SKILLS) {
        Object.values(data.SKILLS).forEach(s => {
            s.target_type = s.target_type || "enemy_single";
            s.dmg_mod = s.dmg_mod !== undefined ? Number(s.dmg_mod) : 1.0;
            s.battle_dice_mod = s.battle_dice_mod !== undefined ? Number(s.battle_dice_mod) : 1.0;
            s.hit_dice_mod = Number(s.hit_dice_mod) || 0;
            s.mod_shock = s.mod_shock !== undefined ? Number(s.mod_shock) : 1.0;
            s.mod_heat = s.mod_heat !== undefined ? Number(s.mod_heat) : 1.0;
            s.mod_elec = s.mod_elec !== undefined ? Number(s.mod_elec) : 1.0;
            
            // 🌟 追加：技ごとの消費コストの初期値
            s.cost_mp = Number(s.cost_mp) || 0;
            s.cost_st = Number(s.cost_st) || 0;
        });
    }

    // 🌟 6. システム設定の補完
    data.maxLevel = Number(data.maxLevel) || 0;
    data.maxItemCount = Number(data.maxItemCount) || 0;
    data.maxSkills = Number(data.maxSkills) || 0;
    data.maxPlayerCount = Number(data.maxPlayerCount) || 50;
    data.battleMemberCount = Number(data.battleMemberCount) || 3;
    data.maxEquipCount = Number(data.maxEquipCount) || 1;
    data.enableStatus = data.enableStatus !== undefined ? data.enableStatus : true;
    data.enableEvolution = data.enableEvolution !== undefined ? data.enableEvolution : true; // 🌟 追加
    data.inBattle = data.inBattle || false;
    data.isPrepPhase = data.isPrepPhase || false; // 🌟 追加：準備中フラグを復元
    return data;
};
// ==========================================
// 🔥 テンション増減＆特性（パッシブ）処理エンジン
// ==========================================

window.changeTension = async function (char, amount, reason = "") {
    if (!state.enableTension || !char || char.hp <= 0) return;

    // 特性：きぶんや
    if (amount > 0 && char.trait === "moody") {
        amount = Math.random() < 0.5 ? 25 : -25;
        reason = `【きぶんや】 気分が変わり、`;
    }

    let oldTension = char.tension || 0;

    // 特性：かっぱつ
    if (amount < 0 && char.trait === "lively" && oldTension + amount < 0) {
        await showMsg(`【かっぱつ】 ${char.name} は テンションを下げられなかった！`);
        await wait(800);
        // マイナスにはならないが、0未満なら0に戻す
        char.tension = Math.max(0, oldTension);
        return;
    }

    const steps = [-100, -50, -25, -5, 0, 5, 25, 50, 100];
    let newRaw = oldTension + amount;

    // 一番近い段階に丸める
    let closest = steps.reduce((prev, curr) => Math.abs(curr - newRaw) < Math.abs(prev - newRaw) ? curr : prev);
    char.tension = closest;

    let diff = char.tension - oldTension;
    // 🌟 修正：テンションの変動が「0」なら、以降の連鎖処理（おうえん等）は絶対に起こさない（無限ループ防止）
    if (diff === 0) return;

    let color = diff > 0 ? "#dd6b20" : "#3182ce";
    let arrow = diff > 0 ? "上がった！" : "下がった...";

    if (reason) {
        await showMsg(`<span style="color:${color}; font-weight:bold;">${reason}<br>${char.name} の テンションが ${char.tension} に ${arrow}</span>`);
        if (diff > 0) playGlitchEffect();
        await wait(1200);
    }

    // 特性：がんばり屋
    if (char.trait === "hardworker") {
        let hpChange = Math.floor(char.maxHp * (diff / 100));
        if (hpChange > 0) {
            char.hp = Math.min(char.maxHp, char.hp + hpChange);
            await showMsg(`【がんばり屋】 テンションの上昇分、HPが ${hpChange} 回復した！`);
        } else if (hpChange < 0) {
            char.hp = Math.max(1, char.hp + hpChange);
            await showMsg(`【がんばり屋】 テンションの下降分、HPが ${Math.abs(hpChange)} 削られた……`);
        }
        await wait(1000);
    }

    // 🌟 修正：連鎖発動する対象（味方・敵）を「熟練度（tech + exp）順」に並び替える！
    const sortBySkill = (team) => {
        return team.filter(c => c && c.hp > 0 && c !== char).sort((a, b) => {
            let aStats = getStats(a, state.player.includes(a));
            let bStats = getStats(b, state.player.includes(b));
            let scoreDiff = (bStats.tech + bStats.exp) - (aStats.tech + aStats.exp);
            return scoreDiff !== 0 ? scoreDiff : (Math.random() < 0.5 ? -1 : 1);
        });
    };

    // 特性：おうえん
    if (diff > 0 && char.trait === "cheer") {
        let allies = state.player.includes(char) ? state.player.slice(0, state.battleMemberCount || 3) : state.enemy;
        let sortedAllies = sortBySkill(allies);

        await showMsg(`【おうえん】 ${char.name} の気合が 味方全員に伝染する！`);
        await wait(800);
        for (let a of sortedAllies) {
            await changeTension(a, 5, "");
        }
    }

    // 特性：ぼやき
    if (diff > 0 && char.trait === "grumble") {
        let enemies = state.player.includes(char) ? state.enemy : state.player.slice(0, state.battleMemberCount || 3);
        let sortedEnemies = sortBySkill(enemies);

        await showMsg(`【ぼやき】 ${char.name} のため息が 敵全員のやる気を削ぐ……`);
        await wait(800);
        for (let e of sortedEnemies) {
            await changeTension(e, -5, "");
        }
    }
};

// 「ためる」コマンドを実行した時の処理
window.executeTensionUp = async function (char) {
    if (!state.enableTension || char.hp <= 0) return;

    await showMsg(`${char.name} は 力を溜めている……！`);
    await wait(1000);

    let amount = 5;
    let hpPer = char.hp / char.maxHp;

    // HP減少によるボーナス（ハイテンション・スーパーハイテンション）
    if (hpPer <= 0.05) { amount = 100; await showMsg(`【スーパーハイテンション】 限界を超えた怒りが爆発する！！`); await wait(1000); }
    else if (hpPer <= 0.25) { amount = 25; await showMsg(`【ハイテンション】 ピンチにより 大きく気合が入った！`); await wait(1000); }

    await changeTension(char, amount, "");

    // UIのステータス欄にテンション値を反映
    await updateUI();
};

window.updateCharStat = function(char, statKey, amount, mode = "recover") {
    if (!char) return;
    
    let currentVal = char[statKey] || 0;
    let nextVal = currentVal;
    
    if (mode === "set") nextVal = amount;
    else if (mode === "recover" || mode === "growth") nextVal = currentVal + amount;

    let statLimit = char["limit_" + statKey] || 9999;
    if (["maxHp", "maxMp", "maxSt", "tech", "exp", "baseDmg", "baseDef", "maxShock", "maxHeat", "maxElec", "recShock", "recHeat", "recElec", "atkShock", "atkHeat", "atkElec"].includes(statKey)) {
        nextVal = Math.min(nextVal, statLimit);
    }
    
    if (statKey !== "statBuff" && statKey !== "tension") { 
        nextVal = Math.max(0, nextVal);
    }
    
    // 🌟 修正2：getStats を使って、呪い(hp_curse等)が反映された「本当の最大値」を取得する
    const currentStats = getStats(char, state.player.includes(char));

    if (statKey === "hp") nextVal = Math.min(currentStats.actualMaxHp || char.maxHp, nextVal);
    else if (statKey === "mp") nextVal = Math.min(currentStats.maxMp || char.maxMp, nextVal);
    else if (statKey === "st") nextVal = Math.min(currentStats.maxSt || char.maxSt, nextVal);

    // 最大値が成長した場合は現在値も同量回復させる
    if (statKey === "maxHp" && mode === "growth" && amount > 0) char.hp = Math.min(char.maxHp + amount, nextVal);
    if (statKey === "maxMp" && mode === "growth" && amount > 0) char.mp = Math.min(char.maxMp + amount, nextVal);
    if (statKey === "maxSt" && mode === "growth" && amount > 0) char.st = Math.min(char.maxSt + amount, nextVal);

    char[statKey] = nextVal;
};
// ==========================================
// 最適化：AA自動スケーリング機能
// ==========================================
window.fitAAToContainer = function(preElement, containerElement) {
    if (!preElement || !containerElement || !preElement.innerText.trim()) return;

    // 🌟 修正1：コンテナの「横幅」だけでなく「高さ」も取得する
    const containerWidth = containerElement.clientWidth - 10;
    const containerHeight = containerElement.clientHeight - 5; // 上下に少し余裕を持たせる
    
    if (containerWidth <= 0 || containerHeight <= 0) return;

    // 「見えない分身」を作って裏で本来のサイズを測る
    const dummy = document.createElement('pre');
    dummy.style.cssText = `
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        font-family: 'BackslashFix', 'aahub', sans-serif;
        font-size: 12px;
        line-height: 1.0;
        white-space: pre;
        width: max-content;
        margin: 0; padding: 0;
    `;
    dummy.innerText = preElement.innerText;
    document.body.appendChild(dummy);

    // 🌟 修正2：影の分身の「高さ」も測る
    const aaWidth = dummy.scrollWidth;
    const aaHeight = dummy.scrollHeight;
    
    document.body.removeChild(dummy);

    if (aaWidth <= 0 || aaHeight <= 0) return;

    // 🌟 修正3：横幅と高さ、それぞれ「枠に収まる倍率」を計算し、厳しい方（小さい方）を採用する
    let scaleW = containerWidth / aaWidth;
    let scaleH = containerHeight / aaHeight;
    let optimalScale = Math.min(scaleW, scaleH);
    
    // 基準の12pxに倍率を掛けて最適なフォントサイズを出す
    let optimalSize = Math.floor(12 * optimalScale);

    if (optimalSize > 24) optimalSize = 24; // PCでの最大サイズ
    if (optimalSize < 4) optimalSize = 4;   // スマホでの最小サイズ

    // 計算が終わった「完成品のサイズ」を本物に適用する
    preElement.style.fontSize = optimalSize + 'px';
};

window.resizeAllAAs = function() {
    // 🌟 修正4：ブラウザが画面を描画し終えた「安全なタイミング」でリサイズを実行する
    requestAnimationFrame(() => {
        // 1. ストーリー画面の背景AA
        const storyAA = document.getElementById('story-aa');
        if (storyAA && storyAA.innerText.trim() !== "") {
            fitAAToContainer(storyAA, storyAA.parentElement);
        }

        // 2. 1vs1バトルのAA
        const pAA = document.querySelector('#p-aa pre');
        if (pAA) fitAAToContainer(pAA, document.getElementById('p-aa'));
        
        const eAA = document.querySelector('#e-aa pre');
        if (eAA) fitAAToContainer(eAA, document.getElementById('e-aa'));

        // 3. パーティバトルのAA（複数人いるのでループで処理）
        document.querySelectorAll('.party-row .p-aa pre').forEach(pre => {
            fitAAToContainer(pre, pre.parentElement);
        });
        
        // 4. トドメのカットインAA
        const cutinAA = document.getElementById('cutin-aa');
        if (cutinAA && cutinAA.offsetParent !== null) { // 表示されている時だけ
            fitAAToContainer(cutinAA, cutinAA.parentElement);
        }
    });
};
// 🌟 追加：ブラウザの限界を突破する、AAの「強制縮小（スケール）」関数
window.applyAAScale = function(preId, boxSize) {
    const aaPre = document.getElementById(preId);
    if (!aaPre) return;
    
    // 上下にある「空の改行」を自動で掃除して顔を真ん中に寄せる
    aaPre.innerText = aaPre.innerText.replace(/^\n+|\n+$/g, '');

    // ダミーを作って「本来のピクセルサイズ」を測る
    const dummy = document.createElement('pre');
    dummy.style.cssText = `position:absolute; visibility:hidden; font-family:'aahub'; font-size:12px; line-height:1.0; white-space:pre; width:max-content; margin:0; padding:0;`;
    dummy.innerText = aaPre.innerText;
    document.body.appendChild(dummy);
    
    const aaWidth = dummy.scrollWidth;
    const aaHeight = dummy.scrollHeight;
    document.body.removeChild(dummy);

    if (aaWidth > 0 && aaHeight > 0) {
        // 枠(boxSize)に対して 90% の大きさに収まるように計算
        let targetSize = boxSize * 0.9;
        let scaleW = targetSize / aaWidth;
        let scaleH = targetSize / aaHeight;
        
        // 縦と横、厳しい方の縮小率を採用する
        let scale = Math.min(scaleW, scaleH);
        
        // 極端に拡大しすぎないように制限
        if (scale > 1.2) scale = 1.2;

        // フォントサイズはブラウザが許す安全な「12px」に固定し、
        // コピー機のように要素そのものを scale(倍率) で縮める！
        aaPre.style.fontSize = "12px";
        aaPre.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
};

// 🌟 追加：スマホの向きを変えたり、ブラウザのサイズを変えた時に自動で再計算する
window.addEventListener('resize', () => {
    // リサイズ中は連続で発火しすぎて重くなるので、少しだけ遅延させる（デバウンス処理）
    clearTimeout(window.aaResizeTimer);
    window.aaResizeTimer = setTimeout(resizeAllAAs, 100);
});

// ==========================================
// ⚔️ タクティカルバトル：オートフォーカス（自動スクロール）機能
// ==========================================
window.focusTacticalCell = function(x, y) {
    const container = document.getElementById("tac-board-container");
    if (!container) return;

    // マスのサイズ(40px) + 隙間(2px) = 42px
    const cellSize = 42; 
    const padding = 4; // 盤面の枠の太さ
    
    // PvPゲスト時のY座標反転を考慮した「見た目上のY座標」
    let drawY = (state.isPvP && typeof isHost !== 'undefined' && !isHost) ? 8 - y : y;
    
    // タップしたマスの、盤面内での中心座標を計算
    const cellCenterX = padding + (x * cellSize) + (cellSize / 2);
    const cellCenterY = padding + (drawY * cellSize) + (cellSize / 2);

    // コンテナ全体の幅と高さ
    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;

    // CSSで設定した右側の余白（UIパネルが覆いかぶさっている「見えない領域」）の幅を取得
    const compStyle = window.getComputedStyle(container);
    const paddingRight = parseFloat(compStyle.paddingRight) || 0;

    // UIに隠れていない「本当に見える左側の安全エリア」の幅
    const visibleWidth = cWidth - paddingRight;

    // スクロール先の計算（マスの中心が、安全エリアのド真ん中に来るようにする）
    let targetScrollLeft = cellCenterX - (visibleWidth / 2);
    let targetScrollTop = cellCenterY - (cHeight / 2);

    // スムーズにスクロールさせる！
    container.scrollTo({
        left: targetScrollLeft,
        top: targetScrollTop,
        behavior: 'smooth'
    });
};// ==========================================
// 💾 セーブデータ共通管理システム (完全網羅版)
// ==========================================

// 1. 現在のゲーム状態を保存用のデータにパッケージングする
window.getGameStateForSave = async function() {
    const globalFlags = await loadFromIndexedDB('globalData', 'flags') || {};
    
    return {
        VERSION: "1.1.0",
        PROJECT_TITLE: state.PROJECT_TITLE || "無題の冒険",
        HASH: await calculateGameHash(),

        // --- 進行データ ---
        money: state.money,
        orbShinsei: state.orbShinsei,
        inventory: state.inventory,
        ownedEquips: state.ownedEquips,
        flags: state.flags,
        currentSceneId: state.currentSceneId,
        currentStepIndex: state.currentStepIndex,
        day: state.day,
        timePeriod: state.timePeriod,
        turnCount: state.turnCount || 1, // 🌟追加：ターン数

        // --- キャラクター・敵のデータ ---
        // 🌟 修正：味方だけでなく、敵も決闘中のバックアップを正として保存する！
        player: (state.tacData && state.tacData.backupPlayer) ? state.tacData.backupPlayer : state.player,
        enemy: (state.tacData && state.tacData.backupEnemy) ? state.tacData.backupEnemy : state.enemy, // 🌟追加

        // --- 戦闘・盤面データ ---
        inBattle: state.inBattle,
        isPrepPhase: state.isPrepPhase,
        tacData: state.tacData,

        // 🌟 演出関連データ（カスタム背景・文字色など）
        customBg: state.customBg,               // 🌟追加
        customTextColor: state.customTextColor, // 🌟追加
        customMsgBg: state.customMsgBg,         // 🌟追加
        customMsgText: state.customMsgText,     // 🌟追加
        customMsgSpeaker: state.customMsgSpeaker,// 🌟追加

        // 危険な演出フラグは必ずリセットして保存（ロード時のフリーズ防止）
        isAnimating: false,
        isWaitingChoice: false,

        // --- システム設定 ---
        msgSpeed: state.msgSpeed !== undefined ? state.msgSpeed : 1.0,
        enableAutoSave: state.enableAutoSave !== undefined ? state.enableAutoSave : true,
        enableLevelUp: state.enableLevelUp, 
        enableResistance: state.enableResistance,
        enableAttribute: state.enableAttribute, 
        enablePartyBattle: state.enablePartyBattle,
        enableAnalyze: state.enableAnalyze, 
        enableStatus: state.enableStatus, 
        enableMpSt: state.enableMpSt,
        maxLevel: state.maxLevel,
        maxItemCount: state.maxItemCount, 
        maxSkills: state.maxSkills,
        skipHitDice: state.skipHitDice, 
        enableItemUse: state.enableItemUse,
        enableEquipChange: state.enableEquipChange, 
        enableEscape: state.enableEscape,
        enableScout: state.enableScout, 
        enableTimeSystem: state.enableTimeSystem, 
        enablePermaDeath: state.enablePermaDeath,
        enableSpReset: state.enableSpReset,
        enableMultiEquip: state.enableMultiEquip,
        enableTension: state.enableTension,
        enableTactical: state.enableTactical,
        enableEvolution: state.enableEvolution !== undefined ? state.enableEvolution : true, // 🌟 追加
        maxPlayerCount: state.maxPlayerCount,
        timeLimit: state.timeLimit, 
        turnLimit: state.turnLimit,
        battleMemberCount: state.battleMemberCount, 
        maxEquipCount: state.maxEquipCount,
        maxPartyCost: state.maxPartyCost,

        globalData: globalFlags
    };
};

// 2. 読み込んだデータを現在のシステムに安全に流し込む
window.applySaveData = async function(loadedData) {
    if (loadedData.globalData) {
        await saveToIndexedDB('globalData', 'flags', loadedData.globalData);
    }

    // 基本データ
    state.money = loadedData.money || 0;
    state.orbShinsei = loadedData.orbShinsei || 0;
    state.inventory = loadedData.inventory || {};
    state.ownedEquips = loadedData.ownedEquips || [];
    state.flags = loadedData.flags || {};
    state.currentSceneId = loadedData.currentSceneId || "start";
    state.currentStepIndex = loadedData.currentStepIndex || 0;
    state.day = loadedData.day || 1;
    state.timePeriod = loadedData.timePeriod || 1;
    state.turnCount = loadedData.turnCount || 1; // 🌟追加

    // キャラクター・敵データ
    state.player = loadedData.player || JSON.parse(JSON.stringify(INITIAL_PLAYER_TEAM));
    state.enemy = loadedData.enemy || []; // 🌟追加
    
    // 戦闘・盤面データ
    state.inBattle = loadedData.inBattle || false;
    state.isPrepPhase = loadedData.isPrepPhase || false;
    state.tacData = loadedData.tacData || null;

    // 🌟 演出関連データの復元
    state.customBg = loadedData.customBg || null;
    state.customTextColor = loadedData.customTextColor || null;
    state.customMsgBg = loadedData.customMsgBg || null;
    state.customMsgText = loadedData.customMsgText || null;
    state.customMsgSpeaker = loadedData.customMsgSpeaker || null;

    // 🌟 AI復活のための座標データ修復（NaNや不正な値を消去）
    if (state.tacData && state.tacData.phase === "battle") {
        state.player.forEach(p => {
            if (p.x === null || isNaN(p.x)) p.x = -1;
            if (p.y === null || isNaN(p.y)) p.y = -1;
        });
        state.enemy.forEach(e => {
            if (e.x === null || isNaN(e.x)) e.x = -1;
            if (e.y === null || isNaN(e.y)) e.y = -1;
        });
    }

    state.msgSpeed = loadedData.msgSpeed !== undefined ? loadedData.msgSpeed : 1.0;
    state.enableAutoSave = loadedData.enableAutoSave !== undefined ? loadedData.enableAutoSave : true;
    
    // システム設定（ON/OFF系）の復元
    const settings = ["enableLevelUp", "enableResistance", "enableAttribute", "enablePartyBattle", "enableAnalyze", "enableStatus", "enableMpSt", "skipHitDice", "enableItemUse", "enableEquipChange", "enableEscape", "enableScout", "enableTimeSystem", "enablePermaDeath", "enableSpReset", "enableMultiEquip", "enableTension", "enableTactical", "enableEvolution"];
    settings.forEach(k => { state[k] = loadedData[k] !== undefined ? loadedData[k] : state[k]; });

    // システム設定（数値系）の復元
    const nums = ["maxLevel", "maxItemCount", "maxSkills", "maxPlayerCount", "timeLimit", "turnLimit", "battleMemberCount", "maxEquipCount", "maxPartyCost"];
    nums.forEach(k => { state[k] = loadedData[k] || 0; });
};
window.cleanUpCharacterBattleFlags = function(char) {
    if (!char) return;
    char.status = "none";
    char.statusTurn = 0;
    delete char.statusAppliedTurn;
    char.tension = 0;
    delete char.tempTensionForCalc;
    if (typeof initResistance === 'function') initResistance(char, state.player.includes(char));
    char.isFirstTurn = true;
    char.turnInBattle = 0;
    char.rechargeTurn = 0;
    char.chargeSkillId = null;
    char.hasDoubleStrike = false;
    char.hasBursted = false;
    char.hasBeenCountered = false;
    char.guaranteeHit = false;
    char.transformCrit = false;
    char.guaranteeDodge = false;
    char.counterActive = false;
    char.statBuff = 0;
    char.resUpShock = false;
    char.resUpHeat = false;
    char.resUpElec = false;
    char.tempEmotion = null;
    char.critCount = 0;
    char.hitCombo = 0;
    char.lastUsedSkill = null;
    char.skillUseCount = 0;
    char.x = -1;
    char.y = -1;
    char.hasActed = false;
    char.justEscaped = false;
    delete char.prevX;
    delete char.prevY;
    delete char.turnDice;
};
