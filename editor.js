let stepIndexCount = 0; let enemyIndexCount = 0; let itemIndexCount = 0; let playerIndexCount = 0; let skillIndexCount = 0; let isBatchLoading = false;

// 🌟追加：チュートリアル（デフォルトデータ）の「絶対保護」用マスターバックアップ
let DEFAULT_SCENARIO = null;
let DEFAULT_ENEMY_MASTER = null;
let DEFAULT_ITEMS = null;
let DEFAULT_SKILLS = null;

// ページ読み込み時に、現在のデータを「原本」として金庫に保管する
window.addEventListener('DOMContentLoaded', () => {
    // ディープコピー（完全な複製）を作成して保存
    if (typeof SCENARIO !== 'undefined') DEFAULT_SCENARIO = JSON.parse(JSON.stringify(SCENARIO));
    if (typeof ENEMY_MASTER !== 'undefined') DEFAULT_ENEMY_MASTER = JSON.parse(JSON.stringify(ENEMY_MASTER));
    if (typeof ITEMS !== 'undefined') DEFAULT_ITEMS = JSON.parse(JSON.stringify(ITEMS));
    if (typeof SKILLS !== 'undefined') DEFAULT_SKILLS = JSON.parse(JSON.stringify(SKILLS));
});

// 🌟追加：Undo/Redo（元に戻す/やり直す）管理システム
let historyStack = [];
let historyPointer = -1;
let isUndoRedoAction = false;

// 履歴に現在の状態を保存する（何か操作するたびに呼ぶ）
window.pushHistory = function() {
    if (isBatchLoading || isUndoRedoAction) return; // ロード中やUndo操作中は記録しない
    
    // 現在のポインターより先の履歴（Redo用）があれば捨てる
    if (historyPointer < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyPointer + 1);
    }
    
    // 現在のエディタの全データをJSON化して保存
    const currentState = JSON.stringify(getEditorJSONData().json);
    
    // 直前の履歴と全く同じなら保存しない（無駄な履歴を省く）
    if (historyPointer >= 0 && historyStack[historyPointer] === currentState) return;

    historyStack.push(currentState);
    
    // 履歴の上限を50回にする（メモリ節約）
    if (historyStack.length > 50) historyStack.shift();
    else historyPointer++;
};

// Ctrl+Z などのキー操作を監視
document.addEventListener('keydown', (e) => {
    // エディタ画面が開かれている時のみ有効
    if (!document.getElementById("view-editor").classList.contains("active")) return;
    // inputなどのテキスト入力中以外で発動させる（※テキスト入力中のCtrl+Zはブラウザ標準の文字戻しに任せる）
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (e.shiftKey) {
                executeRedo(); // Ctrl+Shift+Z でやり直し
            } else {
                executeUndo(); // Ctrl+Z で元に戻す
            }
        } else if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            executeRedo();     // Ctrl+Y でやり直し
        }
    }
});

function executeUndo() {
    if (historyPointer > 0) {
        isUndoRedoAction = true;
        historyPointer--;
        const prevData = JSON.parse(historyStack[historyPointer]);
        loadDataToEditorUI(prevData);
        showToast("↩️ 元に戻しました (Undo)", "info");
        isUndoRedoAction = false;
    } else {
        showToast("これ以上戻せません", "warning");
    }
}

function executeRedo() {
    if (historyPointer < historyStack.length - 1) {
        isUndoRedoAction = true;
        historyPointer++;
        const nextData = JSON.parse(historyStack[historyPointer]);
        loadDataToEditorUI(nextData);
        showToast("↪️ やり直しました (Redo)", "info");
        isUndoRedoAction = false;
    } else {
        showToast("これ以上やり直せません", "warning");
    }
}

window.encodeAA = function (str) {
    if (!str) return "";
    
    // パス指定（ドット区切りで改行なし）の場合はそのまま
    if (str.includes('.') && str.length < 100 && !str.includes('\n')) return str;
    
    try {
        // btoaの前に、バックスラッシュを安全な形にエスケープ（URLエンコードに任せる）
        return btoa(encodeURIComponent(str));
    } catch (e) {
        return str; 
    }
};

window.decodeAA = function (str) {
    if (!str) return "";
    
    if (str.includes('.') && str.length < 100 && !str.includes('\n')) return str;
    
    try {
        // Base64っぽい文字列なら解読
        if (!str.includes('\n') && /^[A-Za-z0-9+/=]+$/.test(str) && str.length > 20) {
            return decodeURIComponent(atob(str));
        }
    } catch (e) { }
    return str; 
};

function getAffinityUI(prefix) {
    let html = `<div class="editor-group"><label>属性相性 (弱/普/半/激/無/反/吸):</label><div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:4px; background:#e2e8f0; padding:8px; border-radius:4px;">`;
    for (let i = 0; i < ATTR_KEYS.length; i++) {
        html += `<div style="font-size:10px; text-align:center;">${ATTR_NAMES[i]}<br><select class="${prefix}-data" data-key="aff_${ATTR_KEYS[i]}" style="padding:2px; font-size:11px; width:100%;"><option value="nm">普</option><option value="wk" style="color:red;">弱</option><option value="hl">半</option><option value="rs">激</option><option value="nu" style="color:gray;">無</option><option value="rp" style="color:blue;">反</option><option value="ab" style="color:green;">吸</option></select></div>`;
    }
    return html + `</div></div>`;
}
function getTraitSelectUI(prefix) {
    let html = `<div class="editor-group"><label>特性 (パッシブスキル):</label><select class="${prefix}-data" data-key="trait">`;
    if (typeof TRAITS !== 'undefined') {
        html += `<option value="none">なし</option>`;
        
        // カテゴリ別に分類するためのリスト
        const groups = {
            "ステータス・火力系": ["potential", "guts", "adversity", "crit_up", "demon_strike", "pinch_crit", "finisher", "sniper", "mastery", "insight", "lucky", "atk_gamble", "def_gamble", "hustle", "spread_attack"],
            "防御・耐性・回避系": ["sturdy", "unyielding_heart", "perfect_guard", "hard_body", "iron_wall", "evasion_step", "gamble_body", "recoil_saver", "fire_master", "elec_master", "ice_master", "wind_master", "water_master", "earth_master", "bomb_master", "dark_master", "wave_master", "light_master", "mystic_master", "spirit_master", "gravity_master", "fight_master", "grass_master"],
            "回復・吸収系": ["regeneration", "auto_heal", "vampire", "melody", "battery", "gourmet_body", "energy_convert", "overflow"],
            "特殊ボディ・反射系": ["metal_body", "ultra_body", "wonder_guard", "magic_bounce", "triple_mirror", "status_mirror", "break_mirror", "paralysis_body", "fire_body", "poison_body", "counter_strike", "reflector"],
            "行動制御・妨害系": ["preemptive", "quick_hands", "double_strike", "pursuit", "dash", "late_bloomer", "stealth", "provoke_aura", "pressure", "infection", "curse", "status_master", "omen", "switcheroo", "mold_breaker", "guard_break", "fire_break", "elec_break", "ice_break", "wind_break", "water_break", "earth_break", "bomb_break", "dark_break", "wave_break", "light_break", "mystic_break", "spirit_break", "gravity_break", "fight_break", "grass_break", "reverse_affinity", "last_burst"],
            "パーティ・盤面支援系": ["strategist", "rearguard", "chain_ally", "chain_enemy"], 
"テンション系": ["lively", "down_body", "heat_up", "turnabout", "runaway_engine", 
                "cheer", "grumble", "badmouth", "moody", "hardworker", 
                "rivalry", "defensive", "full_force"
            ]
        };

        for (let groupName in groups) {
            html += `<optgroup label="■ ${groupName}">`;
            groups[groupName].forEach(k => {
                if (TRAITS[k]) {
                    html += `<option value="${k}">${TRAITS[k].name} - ${TRAITS[k].desc}</option>`;
                }
            });
            html += `</optgroup>`;
        }
    } else { 
        html += `<option value="none">なし</option>`; 
    }
    html += `</select></div>`;
    return html;
}
function getElementSelectUI(prefix) {
    let html = `<div class="editor-group"><label>攻撃属性:</label><select class="${prefix}-data" data-key="atk_element"><option value="none">無属性</option>`;
    for (let i = 0; i < ATTR_KEYS.length; i++) html += `<option value="${ATTR_KEYS[i]}">${ATTR_NAMES[i]}</option>`;
    return html + `</select></div>`;
}
function getStatusSelectUI(prefix) {
    return `<div class="editor-group"><label>付与する状態異常 (3ターン継続):</label><select class="${prefix}-data" data-key="inflict_status">
        <option value="none">なし</option>
        <option value="poison">猛毒 (HP 割合ダメージ)</option>
        <option value="deadly_poison">劇毒 (耐性 割合ダメージ)</option>
        <option value="rot">腐敗 (属性相性が1段階ダウン)</option>
        <option value="freeze">凍結 (被弾時、相手の命中ダイス増加)</option>
        <option value="frostbite">凍傷 (防御力が半減する)</option>
        <option value="paralysis">麻痺 (自身の命中ダイス減少)</option>
        <option value="burn">火傷 (HP 固定ダメージ)</option>
        <option value="blaze">炎上 (耐性 固定ダメージ)</option>
        <option value="sleep">睡眠 (戦闘ダイス 半減)</option>
        <option value="confusion">混乱 (戦闘ダイス勝利時に自傷ダメージ)</option>
        <option value="bleed">出血 (受けるダメージ 2倍)</option>
        <option value="harden">硬化 (防御力 2倍)</option>
        <option value="drown">溺水 (反動 2倍)</option>
        <option value="charm">魅了 (クリティカル以外 外れる)</option>
        <option value="seal">封印 (アイテム 使用不可)</option>
        <option value="slow">鈍足 (パーティバトル 行動順最後)</option>
        <option value="fast">俊足 (パーティバトル 行動順最初)</option>
        <option value="focus">集中 (命中ダイス +1)</option>
        <option value="reverse">反転 (戦闘ダイス・行動順 逆転)</option>
        <option value="stone">石化 (戦闘ダイス 0)</option>
        <option value="provoke">挑発 (通常攻撃のみ使用可能)</option>
        <option value="aging">老化 (耐性回復値 REC が半減)</option>
        <option value="protect">守護 (耐性ゲージへのダメージ 無効)</option>
        <option value="invincible">無敵 (受けるHPダメージ 無効)</option>
        <option value="stagnate">停滞 (ブレイクからの復旧ターン 2倍)</option>
        <option value="aggressive">好戦 (与えるHPダメージ 2倍)</option>
        <option value="exception">例外 (直前に使用した技が使用不可)</option>
        <option value="repetition">反復 (直前に使用した技しか使用不可)</option>
        <option value="doom">破滅 (上書きされず、3ターン後に即死)</option>
        <option value="surehit">必中 (お互いの命中判定が必中になる)</option>
        <option value="fragile">脆弱 (全属性相性が弱点になる)</option>
        <option value="fortress">堅牢 (全属性相性が無効になる)</option>
        <option value="immovable">不動 (反動ダメージが0になる)</option>
        <option value="rage">憤怒 (与ダメ3倍、被ダメ2倍)</option>
        <option value="flat">均一 (全属性相性が半減になる)</option>
        <option value="hp_curse">呪詛 (最大HPが半分になる)</option>
        <option value="res_curse">呪縛 (全耐性の最大値が半分になる)</option>
        <option value="dodge">身躱 (相手の命中率を半分にする)</option>
    </select></div>`;
}

function getResistStatusSelectUI(prefix) {
    return `<div class="editor-group"><label>無効化する状態異常 (防具用):</label><select class="${prefix}-data" data-key="resist_status">
        <option value="none">なし</option>
        <option value="poison">猛毒</option>
        <option value="deadly_poison">劇毒</option>
        <option value="rot">腐敗</option>
        <option value="freeze">凍結</option>
        <option value="frostbite">凍傷</option>
        <option value="paralysis">麻痺</option>
        <option value="burn">火傷</option>
        <option value="blaze">炎上</option>
        <option value="sleep">睡眠</option>
        <option value="confusion">混乱</option>
        <option value="bleed">出血</option>
        <option value="harden">硬化</option>
        <option value="drown">溺水</option>
        <option value="charm">魅了</option>
        <option value="seal">封印</option>
        <option value="slow">鈍足</option>
        <option value="fast">俊足</option>
        <option value="focus">集中</option>
        <option value="reverse">反転</option>
        <option value="stone">石化</option>
        <option value="provoke">挑発</option>
        <option value="aging">老化</option>
        <option value="protect">守護</option>
        <option value="invincible">無敵</option>
        <option value="stagnate">停滞</option>
        <option value="aggressive">好戦</option>
        <option value="exception">例外 (直前に使用した技が使用不可)</option>
        <option value="repetition">反復 (直前に使用した技しか使用不可)</option>
        <option value="doom">破滅 (上書きされず、3ターン後に即死)</option>
        <option value="surehit">必中 (お互いの命中判定が必中になる)</option>
        <option value="fragile">脆弱 (全属性相性が弱点になる)</option>
        <option value="fortress">堅牢 (全属性相性が無効になる)</option>
        <option value="immovable">不動 (反動ダメージが0になる)</option>
        <option value="rage">憤怒 (与ダメ3倍、被ダメ2倍)</option>
        <option value="flat">均一 (全属性相性が半減になる)</option>
        <option value="hp_curse">呪詛 (最大HPが半分になる)</option>
        <option value="res_curse">呪縛 (全耐性の最大値が半分になる)</option>
        <option value="dodge">身躱 (相手の命中率を半分にする)</option>
    </select></div>`;
}
window.switchEditorTab = function (event, tabId) {
    const targetTab = document.getElementById(tabId);
    if (!targetTab) return;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    targetTab.classList.add('active');
    event.currentTarget.classList.add('active');

    // コントロールパネルの要素を取得
    const btnAdd = document.getElementById("btn-editor-add");
    const newIdInput = document.getElementById("new-scene-id");

    // 🌟 シナリオタブかどうかでボタンの表示を切り替える
    const isScenario = (tabId === "tab-scenario");
    document.querySelectorAll('.btn-scenario-only').forEach(el => {
        el.style.display = isScenario ? "inline-block" : "none";
    });
    newIdInput.style.display = isScenario ? "block" : "none";

    // タブに合わせて追加ボタンのテキストを変更
    if (tabId === "tab-scenario") { btnAdd.className = "btn-primary btn-sm"; btnAdd.innerText = "+ 枠追加"; } 
    else if (tabId === "tab-player") { btnAdd.className = "btn-success btn-sm"; btnAdd.innerText = "+ 味方追加"; } 
    else if (tabId === "tab-enemy") { btnAdd.className = "btn-warning btn-sm"; btnAdd.innerText = "+ 敵追加"; } 
    else if (tabId === "tab-item") { btnAdd.className = "btn-custom btn-sm"; btnAdd.innerText = "+ アイテム追加"; } 
    else if (tabId === "tab-skill") { btnAdd.className = "btn-danger btn-sm"; btnAdd.innerText = "+ 技追加"; }

    // 検索リセット
    const searchInput = document.getElementById("editor-search-input");
    if (searchInput) { searchInput.value = ""; filterEditorItems(); }
};
// 🌟 追加：現在のタブに応じて「追加」処理を振り分ける関数
window.handleEditorAdd = function() {
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === "tab-scenario") editorAddScene();
    else if (activeTab === "tab-player") editorAddPlayer();
    else if (activeTab === "tab-enemy") editorAddEnemy();
    else if (activeTab === "tab-item") editorAddItem();
    else if (activeTab === "tab-skill") editorAddSkill();
};

// 🌟 追加：現在のタブに応じて「読込」処理を振り分ける関数
window.handleEditorLoad = function() {
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === "tab-scenario") loadDefaultScenarios();
    else if (activeTab === "tab-player") loadDefaultPlayers();
    else if (activeTab === "tab-enemy") loadDefaultEnemies();
    else if (activeTab === "tab-item") loadDefaultItems();
    else if (activeTab === "tab-skill") loadDefaultSkills();
};
window.updateAAPreview = async function (textarea) {
    if (!textarea) return; // textareaが存在しない場合は即座に安全に終了

    const preview = textarea.nextElementSibling;
    if (preview && preview.classList.contains("aa-preview")) {
        let aaText = (textarea.value || "").trim(); // 未入力(undefined)なら空文字にする

        if (!aaText) {
            preview.innerText = "【未入力】";
            return;
        }

        try {
            if (typeof resolveAA === 'function') {
                aaText = await resolveAA(aaText);
            } else {
                if (typeof AA !== 'undefined') {
                    let obj = AA; 
                    const keys = aaText.split('.');
                    for (let i = 0; i < keys.length; i++) { 
                        if (!obj || obj[keys[i]] === undefined) { obj = aaText; break; } 
                        obj = obj[keys[i]]; 
                    }
                    aaText = typeof obj === "string" ? obj : aaText;
                }
            }
        } catch (e) {
            console.warn("AAプレビュー生成中にエラー（続行します）:", e);
            // エラーが起きてもシステムを止めず、入力された文字をそのまま表示する
        }
        
        preview.innerText = aaText;
    }
};
function getSceneSelectUI(dataClass, key, placeholder, isHeader = false) {
    let inputHtml = isHeader 
        ? `<input type="text" class="${dataClass}" placeholder="${placeholder}" list="scene-list" style="width:120px; padding:2px 5px; border:1px solid #90cdf4; border-radius:4px;">`
        : `<input type="text" class="${dataClass} w-100" data-key="${key}" placeholder="${placeholder}" list="scene-list" style="flex:1;">`;

    return `<div style="display:flex; gap:2px; align-items:center; flex:1;">
        ${inputHtml}
        <select class="scene-helper-select" style="width:22px; height:22px; padding:0; border-radius:4px; border:1px solid #cbd5e0; background:#edf2f7; cursor:pointer; font-weight:bold; color:#4a5568;" onchange="if(this.value){ const inp = this.previousElementSibling; inp.value=this.value; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); this.value=''; }" title="既存のシーンから選ぶ">
            <option value="">▼</option>
        </select>
    </div>`;
}
function getStepHTML(type, index) {
    let content = "";
if (type === "system_set") content = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; background:#f7fafc; padding:12px; border-radius:6px; border:1px solid #cbd5e0;">
        <div style="grid-column: 1 / -1; font-weight:bold; color:#2b6cb0; border-bottom:1px solid #cbd5e0; margin-bottom:5px; padding-bottom:5px;">⚙️ 各種機能の ON / OFF</div>
        
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableLevelUp" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> レベル成長</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableResistance" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 耐性(ブレイク)</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableAttribute" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 属性相性</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableStatus" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 状態異常</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enablePartyBattle" style="width:16px; height:16px; flex-shrink:0; margin:0;"> パーティバトル</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableTactical" style="width:16px; height:16px; flex-shrink:0; margin:0;"> 盤面バトル</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableAnalyze" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 属性公開(アナライズ)</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="skipHitDice" style="width:16px; height:16px; flex-shrink:0; margin:0;"> 命中演出の省略</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableItemUse" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 戦闘中アイテム使用</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableEquipChange" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 戦闘中装備変更</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableEscape" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> 逃走可能</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableScout" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> スカウト可能</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableTimeSystem" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> カレンダー・時計</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enablePermaDeath" style="width:16px; height:16px; flex-shrink:0; margin:0;"> <span style="color:#e53e3e; font-weight:bold;">死亡ロスト(人生縛り)</span></label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableSpReset" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> <span style="color:#d69e2e; font-weight:bold;">SP振り直し許可</span></label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableMultiEquip" style="width:16px; height:16px; flex-shrink:0; margin:0;"> 同一アイテムの重複装備</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableTension" style="width:16px; height:16px; flex-shrink:0; margin:0;"> テンションシステム</label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableMpSt" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> <span style="color:#9f7aea; font-weight:bold;">MP・STリソース</span></label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; white-space: nowrap;"><input type="checkbox" class="step-data" data-key="enableEvolution" checked style="width:16px; height:16px; flex-shrink:0; margin:0;"> <span style="color:#38a169; font-weight:bold;">進化配合を許可</span></label>
    </div>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:10px;">
        <div class="editor-group"><label>最大レベル (0=無制限):</label><input type="number" class="step-data" data-key="maxLevel" value="0"></div>
        <div class="editor-group"><label>アイテム最大所持数 (0=無制限):</label><input type="number" class="step-data" data-key="maxItemCount" value="0"></div>
        <div class="editor-group"><label>技の最大数 (0=無制限):</label><input type="number" class="step-data" data-key="maxSkills" value="0"></div>
        <div class="editor-group"><label>味方の最大人数 (先発+控え):</label><input type="number" class="step-data" data-key="maxPlayerCount" value="50"></div>
        <div class="editor-group"><label>パーティバトルに出る人数 (2〜6):</label><input type="number" class="step-data" data-key="battleMemberCount" value="3" min="2" max="6"></div>
        <div class="editor-group"><label>1人の最大装備数 (1〜5):</label><input type="number" class="step-data" data-key="maxEquipCount" value="1" min="1" max="5"></div>
        <div class="editor-group"><label>思考制限(秒/0=無制限):</label><input type="number" class="step-data" data-key="timeLimit" value="0"></div>
        <div class="editor-group"><label>ターン制限 (0=無制限):</label><input type="number" class="step-data" data-key="turnLimit" value="0"></div>
        <div class="editor-group"><label>パーティ最大コスト (0=無制限):</label><input type="number" class="step-data" data-key="maxPartyCost" value="0"></div>
    </div>`;
     else if (type === "msg") content = `
        <div class="editor-group"><label>話者:</label><input type="text" class="step-data" data-key="speaker" placeholder="村人" list="char-list"></div>
        <div class="editor-group"><label>AA (パス指定 または 直接入力):</label><textarea class="step-data aa-input" data-key="aa" rows="4" placeholder="CHARACTER.YARUO など" oninput="updateAAPreview(this)"></textarea><pre class="aa-preview" style="min-height: 40px; background: #1a202c; color: #e2e8f0; padding: 5px; border-radius: 4px; font-size: 10px;"></pre></div>
        <div class="editor-group"><label>セリフ:</label><textarea class="step-data" data-key="text" rows="2"></textarea></div>`;
    else if (type === "choice") content = `
        <div style="display:flex; flex-direction:column; gap:5px;">
            <div class="editor-group" style="display:flex; gap:5px;"><input type="text" class="step-data" data-key="c1_text" placeholder="選択肢1" style="flex:1;">${getSceneSelectUI("step-data", "c1_next", "遷移先ID")}</div>
            <div class="editor-group" style="display:flex; gap:5px;"><input type="text" class="step-data" data-key="c2_text" placeholder="選択肢2" style="flex:1;">${getSceneSelectUI("step-data", "c2_next", "遷移先ID")}</div>
            <div class="editor-group" style="display:flex; gap:5px;"><input type="text" class="step-data" data-key="c3_text" placeholder="選択肢3 (空欄非表示)" style="flex:1;">${getSceneSelectUI("step-data", "c3_next", "遷移先ID")}</div>
            <div class="editor-group" style="display:flex; gap:5px;"><input type="text" class="step-data" data-key="c4_text" placeholder="選択肢4 (空欄非表示)" style="flex:1;">${getSceneSelectUI("step-data", "c4_next", "遷移先ID")}</div>
        </div>`;
    
    else if (type === "battle") content = `
        <div class="editor-group" style="background:#fff5f5; padding:8px; border-radius:4px; border:1px solid #fc8181; margin-bottom:5px;">
            <label style="color:#c53030; font-weight:bold;">⚔️ 出現する敵（カンマ区切り）:</label>
            <input type="text" class="step-data" data-key="enemies" placeholder="スライム, ゴブリン" list="enemy-list">
            
            <div style="display:flex; gap:5px; margin-top:5px;">
                <div class="editor-group" style="flex:1;"><label>先制の決め方:</label><select class="step-data" data-key="initiative"><option value="stats">技＋経の合計</option><option value="player">味方確定</option><option value="enemy">敵確定</option></select></div>
            </div>
            
            <div style="margin-top:5px;">
                <label>盤面マップ (タクティカルONの時のみ使用 / 9x9 / #:壁, .:床):</label>
                <textarea class="step-data" data-key="mapData" rows="4" style="font-family:monospace; line-height:1; letter-spacing:2px;">.........\n.........\n.........\n.........\n.........\n.........\n.........\n.........\n.........</textarea>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
            <div class="editor-group"><label style="color:#3182ce;">勝利時のジャンプ先:</label>${getSceneSelectUI("step-data", "win", "win_route")}</div>
            <div class="editor-group"><label style="color:#e53e3e;">敗北時のジャンプ先:</label>${getSceneSelectUI("step-data", "lose", "game_over")}</div>
            <div class="editor-group"><label style="color:#805ad5;">相打ち時 <span style="font-size:10px;">(空で『敗北』と同じ)</span>:</label>${getSceneSelectUI("step-data", "draw", "draw_route")}</div>
            <div class="editor-group"><label>逃走時 <span style="font-size:10px;">(空で『敗北』と同じ)</span>:</label>${getSceneSelectUI("step-data", "escape", "escape_route")}</div>
            <div class="editor-group"><label style="color:#38a169;">捕獲時 <span style="font-size:10px;">(空で『勝利』と同じ)</span>:</label>${getSceneSelectUI("step-data", "scout", "scout_route")}</div>
        </div>`;
    else if (type === "jump") content = `<div class="editor-group"><label>ジャンプ先のシーンID:</label>${getSceneSelectUI("step-data", "next", "next_scene")}</div>`;
    else if (type === "shop") content = `<div class="editor-group"><label>販売するアイテムID（カンマ区切り）:</label><input type="text" class="step-data" data-key="items" placeholder="heal_1, sw_1:G_clear>=1"></div><div style="font-size:10px; color:#718096; margin-top:2px;">※ アイテムID:フラグ名>=値 と書くと、条件を満たした時だけ店頭に並ぶ「限定品」になります！</div>`;
    else if (type === "dice_choice") content = `
        <div class="editor-group"><label>話者:</label><input type="text" class="step-data" data-key="speaker" placeholder="運命の女神" list="char-list"></div>
        <div class="editor-group"><label>AA (パス指定 または 直接入力):</label><textarea class="step-data aa-input" data-key="aa" rows="4" placeholder="CHARACTER.YARUO など" oninput="updateAAPreview(this)"></textarea><pre class="aa-preview" style="min-height: 40px; background: #1a202c; color: #e2e8f0; padding: 5px; border-radius: 4px; font-size: 10px;"></pre></div>
        <div class="editor-group"><label>判定説明 (text):</label><textarea class="step-data" data-key="text" rows="2" placeholder="1〜50:失敗 / 51〜100:成功"></textarea></div>
        <div class="editor-group"><label>ダイス最大値 (diceMax):</label><input type="number" class="step-data" data-key="diceMax" value="100"></div>
        <div class="editor-group"><label>分岐1 (min, max, next):</label><div style="display:flex; gap:5px;"><input type="number" class="step-data" data-key="opt1_min" placeholder="1"><input type="number" class="step-data" data-key="opt1_max" placeholder="50">${getSceneSelectUI("step-data", "opt1_next", "bad_route")}</div></div>
        <div class="editor-group"><label>分岐2 (min, max, next):</label><div style="display:flex; gap:5px;"><input type="number" class="step-data" data-key="opt2_min" placeholder="51"><input type="number" class="step-data" data-key="opt2_max" placeholder="100">${getSceneSelectUI("step-data", "opt2_next", "good_route")}</div></div>`;
        
     else if (type === "stat_roll") content = `
        <div class="editor-group"><label>話者:</label><input type="text" class="step-data" data-key="speaker" placeholder="女神" list="char-list"></div>
        <div class="editor-group"><label>AA (パス指定 または 直接入力):</label><textarea class="step-data aa-input" data-key="aa" rows="4" placeholder="CHARACTER.YARUO など" oninput="updateAAPreview(this)"></textarea><pre class="aa-preview" style="min-height: 40px; background: #1a202c; color: #e2e8f0; padding: 5px; border-radius: 4px; font-size: 10px;"></pre></div>
        <div class="editor-group"><label>セリフ:</label><textarea class="step-data" data-key="text" rows="2" placeholder="君の能力をダイスで決めるお！"></textarea></div>
        <div style="display:flex; gap:5px; margin-bottom:5px;">
            <div class="editor-group" style="flex:1;"><label>対象キャラID:</label><input type="text" class="step-data" data-key="targetId" placeholder="yaruo" list="player-id-list"></div>
            <div class="editor-group" style="flex:1;"><label>振り直し回数:</label><input type="number" class="step-data" data-key="rerolls" value="3"></div>
        </div>

        <div style="background:#edf2f7; padding:8px; border-radius:4px; border:1px solid #cbd5e0;">
            <label style="color:#2b6cb0; font-weight:bold;">🎲 決定するステータス (最大5つ / 使わない枠は「なし」にする)</label>
            ${[1, 2, 3, 4, 5].map(i => `
            <div style="display:flex; gap:5px; margin-top:5px;">
                <select class="step-data" data-key="statKey${i}" style="flex:2;">
                    <option value="none" ${i > 3 ? 'selected' : ''}>なし</option>
                    <option value="maxHp" ${i === 1 ? 'selected' : ''}>最大HP</option>
                    <option value="maxMp">最大MP</option>
                    <option value="maxSt">最大ST</option>
                    <option value="tech" ${i === 2 ? 'selected' : ''}>技術(tech)</option>
                    <option value="exp" ${i === 3 ? 'selected' : ''}>経験(exp)</option>
                    <option value="baseDmg">基礎攻撃力</option>
                    <option value="baseDef">基礎防御力</option>
                </select>
                <input type="text" class="step-data" data-key="dice${i}" value="1d100+10" placeholder="1d100+10" style="flex:1;" ${i === 1 ? 'title="個数 d 面数 + 基礎値"' : ''}>
            </div>`).join('')}
            <div style="font-size:10px; color:#718096; margin-top:4px;">※ ダイス式は「(振る個数) d (ダイスの面数) + (基礎値)」の形式。<b>変数 {tech} なども使えます！</b></div>
        </div>`;
    else if (type === "map") content = `
        <div class="editor-group"><label>マップ視点:</label><select class="step-data" data-key="viewType"><option value="top">俯瞰 (ポケモン風)</option><option value="side">横視点 (マリオ風・重力あり)</option><option value="iso">2.5D (クォータービュー)</option></select></div>
        <div class="editor-group"><label>マップデータ (#:壁, .:床, S:開始位置, その他英字:イベント):</label><textarea class="step-data" data-key="mapData" rows="6" style="font-family:monospace; line-height:1;">##########\n#S.......#\n#...###..#\n#...E....#\n##########</textarea></div>
        <div class="editor-group"><label>イベント定義 (記号:シーンID をカンマ区切りで):</label><input type="text" class="step-data" data-key="events" placeholder="E:boss_battle, A:treasure" list="scene-list"></div>`;
    else if (type === "party_edit") content = `<div class="editor-group"><label style="color:#38a169;">※このステップを通ると「預かり所（パーティ編成）」画面が開きます。</label></div>`;
    else if (type === "fusion") content = `<div class="editor-group"><label style="color:#805ad5;">※このステップを通ると「配合所（ステータス・技継承）」画面が開きます。</label></div>`;
else if (type === "stat_change") content = `
        <div style="background:#f7fafc; padding:8px; border-radius:4px; border:1px solid #cbd5e0; margin-bottom:5px;">
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <div class="editor-group" style="flex:1;">
                    <label style="color:#2b6cb0; font-weight:bold;">👤 対象キャラID (空欄で全員):</label>
                    <input type="text" class="step-data" data-key="targetId" placeholder="空欄ならパーティ全体" list="player-id-list">
                </div>
                <div class="editor-group" style="flex:1;">
                    <label style="color:#e53e3e; font-weight:bold;">⚙️ 操作モード:</label>
                    <select class="step-data" data-key="mode">
                        <option value="recover">回復 / 消費 (現在値の増減)</option>
                        <option value="growth">上昇 / 下降 (基礎値・上限の増減)</option>
                        <option value="set">代入 (指定した状態・数値にする)</option>
                    </select>
                </div>
            </div>

            <div style="display:flex; gap:5px;">
                <div class="editor-group" style="flex:1;">
                    <label>🎯 操作するステータス (カンマ区切りOK):</label>
                    <!-- 🌟 修正：list="stat-key-list" を追加してサジェストを有効化 -->
                    <input type="text" class="step-data" data-key="statKey" value="hp" placeholder="hp, tech, exp など" list="stat-key-list">
                </div>
                <div class="editor-group" style="flex:1;">
                    <label>🔢 増減量 / 設定値 (変数OK):</label>
                    <input type="text" class="step-data" data-key="amount" value="10" placeholder="{yaruo.tech} * 2 など">
                </div>
            </div>
            <div style="font-size:10px; color:#718096; margin-top:4px; line-height:1.4;">
                ※ 操作ステータスに <b>hp, tech, sp</b> のようにカンマで複数書くと、すべて同時に変化します！
            </div>
        </div>
        <div class="editor-group">
            <label>💬 実行時のメッセージ (空欄で非表示 / 変数OK):</label>
            <input type="text" class="step-data" data-key="msg" placeholder="{yaruo.name} のステータスが変化した！">
        </div>`;
        
    // 🌟 新機能：転職用UI
    else if (type === "job_change") content = `
        <div style="background:#faf5ff; padding:8px; border-radius:4px; border:2px solid #9f7aea; margin-bottom:5px;">
            <label style="color:#553c9a; font-weight:bold; display:block; margin-bottom:5px;">✨ ジョブチェンジ（転職 / 変身）</label>
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <div class="editor-group" style="flex:1;">
                    <label>👤 対象キャラID (空欄で全員):</label>
                    <div style="display:flex; gap:2px; align-items:center;">
                        <input type="text" class="step-data w-100" data-key="targetId" placeholder="空欄ならパーティ全員" list="player-id-list" style="flex:1;">
                        <select class="scene-helper-select" data-list-type="player" style="width:22px; height:22px; padding:0; border-radius:4px; border:1px solid #cbd5e0; background:#edf2f7; cursor:pointer; font-weight:bold; color:#4a5568;" onchange="if(this.value){ const inp = this.previousElementSibling; inp.value=this.value; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); this.value=''; }" title="リストから選ぶ"><option value="">▼</option></select>
                    </div>
                </div>
                <div class="editor-group" style="flex:1;">
                    <label style="color:#e53e3e; font-weight:bold;">🗡️ 転職先のジョブID:</label>
                    <div style="display:flex; gap:2px; align-items:center;">
                        <input type="text" class="step-data w-100" data-key="jobId" placeholder="warrior 等" list="player-id-list" style="flex:1;">
                        <select class="scene-helper-select" data-list-type="player" style="width:22px; height:22px; padding:0; border-radius:4px; border:1px solid #cbd5e0; background:#edf2f7; cursor:pointer; font-weight:bold; color:#4a5568;" onchange="if(this.value){ const inp = this.previousElementSibling; inp.value=this.value; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); this.value=''; }" title="リストから選ぶ"><option value="">▼</option></select>
                    </div>
                </div>
            </div>
            <div style="font-size:11px; color:#718096; line-height:1.4;">
                ※ 覚えている技は全て引き継がれ、これまで稼いだ全SPの<b>半分（50%）を維持したまま</b>再スタートします。
            </div>
        </div>`;
        else if (type === "join_party") content = `
        <div style="background:#f0fff4; padding:8px; border-radius:4px; border:1px solid #9ae6b4; margin-bottom:5px;">
            <label style="color:#276749; font-weight:bold; display:block; margin-bottom:5px;">🤝 仲間加入イベント</label>
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <div class="editor-group" style="flex:1;">
                    <label>仲間にするキャラのID:</label>
                    <div style="display:flex; gap:2px; align-items:center;">
                        <input type="text" class="step-data w-100" data-key="targetId" placeholder="キャラID" list="player-id-list" style="flex:1;">
                        <select class="scene-helper-select" data-list-type="player" style="width:22px; height:22px; padding:0; border-radius:4px; border:1px solid #cbd5e0; background:#edf2f7; cursor:pointer; font-weight:bold; color:#4a5568;" onchange="if(this.value){ const inp = this.previousElementSibling; inp.value=this.value; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true})); this.value=''; }" title="リストから選ぶ"><option value="">▼</option></select>
                    </div>
                </div>
            </div>
            <div class="editor-group">
                <label>加入時のメッセージ (空欄で非表示 / 変数 {name} が使えます):</label>
                <input type="text" class="step-data" data-key="msg" placeholder="{name} が なかまに くわわった！">
            </div>
            <div style="font-size:11px; color:#718096; margin-top:2px;">
                ※「味方キャラ」タブで作ったキャラを呼び出します。すでに仲間になっている場合は増殖しません。
            </div>
        </div>`;
    else if (type === "minigame") content = `
        <div style="display:flex; gap:5px; background:#edf2f7; padding:8px; border-radius:4px; border:1px solid #cbd5e0; margin-bottom:5px;">
            <div class="editor-group" style="flex:2;"><label style="color:#2b6cb0; font-weight:bold;">🎮 ゲーム種類:</label>
                <select class="step-data" data-key="gameType" onchange="editorUpdateMinigameUI(this)">
                    <optgroup label="カジノ">
                        <option value="slot">🎰 スロット</option>
                        <option value="roulette">🎡 ルーレット(丁半)</option>
                        <option value="poker">🃏 ポーカー</option>
                    </optgroup>
                    <optgroup label="アクション">
                        <option value="gauge">🎯 ゲージ止め (旧:釣り/採掘)</option>
                        <option value="qte">⚡ QTE (突発ボタン対応)</option>
                        <option value="mash">💢 連打 (マッシング)</option>
                    </optgroup>
                    <optgroup label="パズル">
                        <option value="tetris">🧩 簡易パズル (ブロック落とし)</option>
                    </optgroup>
                </select>
            </div>
            <div class="editor-group" style="flex:2;"><label style="color:#2b6cb0; font-weight:bold;">📝 画面タイトル (例: 宝箱の解錠):</label>
                <input type="text" class="step-data" data-key="mgTitle" placeholder="空欄なら自動設定されます">
            </div>
        </div>

        <!-- 🌟 修正：対象キャラIDの入力欄を追加 -->
        <div style="display:flex; gap:5px;">
            <div class="editor-group mg-bet-ui" style="flex:1;"><label>コストの種類:</label><select class="step-data" data-key="betType"><option value="money">お金 (G)</option><option value="hp">指定キャラのHP</option><option value="sp">指定キャラのSP</option></select></div>
            <div class="editor-group mg-bet-ui" style="flex:1;"><label>対象キャラID(空欄で先頭):</label><input type="text" class="step-data" data-key="targetId" placeholder="my_hero" list="player-id-list"></div>
            <div class="editor-group mg-bet-ui" style="flex:1;"><label>1回のコスト量:</label><input type="number" class="step-data" data-key="betAmount" value="0"></div>
            <div class="editor-group" style="flex:1;"><label>遊べる回数 (0で無制限):</label><input type="number" class="step-data" data-key="playLimit" value="0"></div>
        </div>

        <div style="display:flex; gap:5px; margin-top:5px; background:#fff5f5; padding:8px; border:1px solid #fc8181; border-radius:4px;">
            <div class="editor-group" style="flex:1;"><label style="color:#38a169; font-weight:bold;">成功時のジャンプ先:</label>${getSceneSelectUI("step-data", "nextScene", "next_route")}</div>
            <div class="editor-group" style="flex:1;"><label style="color:#c53030; font-weight:bold;">失敗時のジャンプ先:</label>${getSceneSelectUI("step-data", "failScene", "fail_route")}</div>
            <label style="flex:1; font-size:11px; display:flex; align-items:center; gap:5px; color:#c53030; font-weight:bold; cursor:pointer;">
                <input type="checkbox" class="step-data" data-key="requireSuccess"> 1回成功するまで<br>終了禁止
            </label>
        </div>

        <div class="editor-group mg-action-ui" style="display:none; background:#ebf8ff; padding:5px; border-radius:4px; border:1px solid #90cdf4; margin-top:5px;">
            <div style="display:flex; gap:5px;">
                <div class="editor-group" style="flex:1;"><label style="color:#2b6cb0;">難易度 (1〜5):</label><input type="number" class="step-data" data-key="difficulty" value="3"></div>
                <div class="editor-group" style="flex:2;"><label style="color:#2b6cb0;">成功時の入手アイテムID (カンマでランダム):</label><input type="text" class="step-data" data-key="rewards" placeholder="空欄なら報酬なし"></div>
            </div>
            <div style="font-size:10px; color:#718096; margin-top:2px;">
                ※ 操作説明は、選んだ「ゲーム種類」に応じて自動的にプレイヤーへ表示されます。<br>
                ※ 対象キャラの「技術(tech)」が高いほど、アクション系の難易度が緩和されます！
            </div>
        </div>
    `;
    else if (type === "pass_time") content = `<div style="display:flex; gap:10px;"><div class="editor-group" style="width:120px;"><label>進める時間数:</label><input type="number" class="step-data" data-key="amount" value="1"></div><div class="editor-group" style="flex:1;"><label>経過時のメッセージ(空で非表示):</label><input type="text" class="step-data" data-key="msg" placeholder="ひと晩休んだ…（翌日の朝になった）"></div></div><div style="font-size:10px; color:#718096; margin-top:2px;">※ 1進めると次の時間帯(朝→昼→夕→夜)になり、夜の次は翌日の朝になります。</div>`;

    
// 🟢 修正後（まるごと上書き用）
    else if (type === "bg_set") content = `
        <div style="background:#edf2f7; padding:10px; border-radius:8px; border:1px solid #cbd5e0;">
            <div style="font-weight:bold; color:#2b6cb0; margin-bottom:8px; border-bottom:1px solid #cbd5e0;">🖼️ 全体背景の設定</div>
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <div class="editor-group" style="flex:1;"><label>背景プリセット:</label>
                    <select class="step-data" data-key="preset" onchange="const root = this.closest('.step-body'); const inp = root.querySelector('[data-key=\\'custom_bg\\']'); inp.value = this.value; inp.disabled = (this.value !== 'custom');">
                        <option value="auto">🌅 時間帯に合わせる (オート)</option>
                        <option value="linear-gradient(to bottom, #c6f6d5, #9ae6b4)">🌳 森 (緑)</option>
                        <option value="linear-gradient(to bottom, #bee3f8, #90cdf4)">🌊 海・川 (水色)</option>
                        <option value="linear-gradient(to bottom, #718096, #4a5568)">⛰️ 洞窟 (グレー)</option>
                        <option value="linear-gradient(to bottom, #fed7d7, #feb2b2)">🌋 火山・魔王城 (赤)</option>
                        <option value="linear-gradient(to bottom, #e9d8fd, #d6bcfa)">🔮 異空間 (紫)</option>
                        <option value="custom">✍️ カスタム設定</option>
                    </select>
                    <div style="display:flex; gap:5px; margin-top:5px;">
                        <input type="color" value="#ffffff" style="width:40px; height:24px; padding:0;" oninput="this.nextElementSibling.value = this.value; this.closest('.editor-group').querySelector('select').value = 'custom'; this.nextElementSibling.disabled = false;">
                        <input type="text" class="step-data" data-key="custom_bg" value="auto" style="font-size:10px; background:#fff; flex:1;" disabled placeholder="#FFF や linear-gradient(...)">
                    </div>
                </div>
                <div class="editor-group" style="flex:1;"><label>AA文字色:</label>
                    <select class="step-data" data-key="textColor">
                        <option value="auto">🌙 背景に合わせて自動</option>
                        <option value="#1a202c">黒色 (明るい背景用)</option>
                        <option value="#e2e8f0">白色 (暗い背景用)</option>
                    </select>
                </div>
            </div>

            <div style="font-weight:bold; color:#38a169; margin-bottom:8px; border-bottom:1px solid #cbd5e0;">💬 メッセージ枠の設定</div>
            <div style="display:flex; gap:10px;">
                <div class="editor-group" style="flex:1;"><label>枠の背景色:</label>
                    <div style="display:flex; gap:5px;">
                        <input type="color" value="#000000" style="width:40px; height:24px; padding:0;" oninput="this.nextElementSibling.value = this.value;">
                        <input type="text" class="step-data" data-key="msgBg" value="rgba(0,0,0,0.85)" style="font-size:10px; background:#fff; flex:1;" placeholder="rgba(0,0,0,0.85)">
                    </div>
                </div>
                <div class="editor-group" style="flex:1;"><label>セリフ文字色:</label>
                    <div style="display:flex; gap:5px;">
                        <input type="color" value="#ffffff" style="width:40px; height:24px; padding:0;" oninput="this.nextElementSibling.value = this.value;">
                        <input type="text" class="step-data" data-key="msgText" value="#ffffff" style="font-size:10px; background:#fff; flex:1;" placeholder="#ffffff">
                    </div>
                </div>
                <div class="editor-group" style="flex:1;"><label>名前の色:</label>
                    <div style="display:flex; gap:5px;">
                        <input type="color" value="#ecc94b" style="width:40px; height:24px; padding:0;" oninput="this.nextElementSibling.value = this.value;">
                        <input type="text" class="step-data" data-key="msgSpeaker" value="#ecc94b" style="font-size:10px; background:#fff; flex:1;" placeholder="#ecc94b">
                    </div>
                </div>
            </div>
        </div>`;
    else if (type === "craft") content = `
        <div style="display:flex; gap:5px; margin-bottom:5px;">
            <div class="editor-group" style="flex:1;"><label>画面のタイトル (例: 料理鍋):</label><input type="text" class="step-data" data-key="title" value="アトリエ"></div>
            <div class="editor-group" style="flex:1;"><label>表示カテゴリ (空欄で全レシピ表示):</label><input type="text" class="step-data" data-key="category" placeholder="料理"></div>
        </div>
        
        <div style="background:#ebf8ff; padding:8px; border-radius:4px; border:1px solid #3182ce;">
            <label style="color:#2b6cb0; font-weight:bold; display:block; margin-bottom:5px;">🎯 作成目標（ノルマ）の設定</label>
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <div class="editor-group" style="flex:2;"><label>目標アイテムID (空欄で目標なし):</label><input type="text" class="step-data" data-key="targetItem" placeholder="heal_2" list="item-list"></div>
                <div class="editor-group" style="flex:1;"><label>必要作成数:</label><input type="number" class="step-data" data-key="targetCount" value="1"></div>
            </div>
            <div style="display:flex; gap:5px; margin-top:5px;">
            <div class="editor-group" style="flex:1;"><label style="color:#38a169;">目標達成時のジャンプ先:</label>${getSceneSelectUI("step-data", "trueNext", "success_route")}</div>
            <div class="editor-group" style="flex:1;"><label style="color:#e53e3e;">未達成時のジャンプ先:</label>${getSceneSelectUI("step-data", "falseNext", "fail_route")}</div>
        </div>
        <div style="font-size:10px; color:#718096; margin-top:2px;">※ 目標を設定すると、「アトリエを出る」時に判定され、作った数に応じてルートが分岐します。</div>
        </div>`;
    else if (type === "give") content = `
        <div style="display:flex; gap:5px;">
            <div class="editor-group" style="flex:1;">
                <label>📦 付与 / 没収するアイテムID:</label>
                <input type="text" class="step-data" data-key="target" placeholder="heal_1 等" list="item-list">
            </div>
            <div class="editor-group" style="width:120px;">
                <label>数量 (-で没収):</label>
                <input type="number" class="step-data" data-key="amount" value="1">
            </div>
        </div>
        <div style="font-size:10px; color:#718096; margin-top:2px;">
            ※ マイナスの数値（例: -1）を入れると、対象のアイテムを没収します。<br>
            ※ お金や経験値などの「パラメータ」の増減は【能力増減】ステップを使用してください。
        </div>`;
    else if (type === "flag_set") content = `
        <div style="display:flex; gap:5px;">
            <div class="editor-group" style="flex:1;"><label>対象キャラID(空欄で全体):</label><input type="text" class="step-data" data-key="targetId" placeholder="空欄=システムフラグ" list="player-id-list"></div>
            <div class="editor-group" style="flex:2;"><label>操作する変数名 (例: affection):</label><input type="text" class="step-data" data-key="flagName" placeholder="affection"></div>
        </div>
        <div style="display:flex; gap:5px;">
            <div class="editor-group" style="flex:1;"><label>操作:</label><select class="step-data" data-key="operator"><option value="=">代入 (=)</option><option value="+=">加算 (+=)</option><option value="-=">減算 (-=)</option><option value="*=">乗算 (*=)</option><option value="/=">除算 (/=)</option></select></div>
            <div class="editor-group" style="flex:2;"><label>設定する値 (数値など):</label><input type="text" class="step-data" data-key="flagValue" value="1"></div>
        </div>
        <div style="font-size:10px; color:#718096; margin-top:2px; line-height:1.4;">
            ※ 対象キャラを指定すると「そのキャラの好感度」などを操作できます。<br>
            ※ 空欄のまま <b>day</b> を操作すると日数を、<b>timePeriod</b> を操作すると時間帯(0:朝〜3:夜)を強制変更できます。
        </div>`;
    else if (type === "flag_check") content = `
        <div style="display:flex; gap:5px;">
            <div class="editor-group" style="flex:1;"><label>対象キャラID(空欄で全体):</label><input type="text" class="step-data" data-key="targetId" placeholder="空欄=システムフラグ" list="player-id-list"></div>
            <div class="editor-group" style="flex:2;"><label>確認する変数名 (例: day, timePeriod):</label><input type="text" class="step-data" data-key="flagName" placeholder="timePeriod"></div>
        </div>
        <div style="display:flex; gap:5px;">
            <div class="editor-group" style="flex:1;"><label>条件:</label><select class="step-data" data-key="condition"><option value="==">等しい (==)</option><option value=">=">以上 (>=)</option><option value="<=">以下 (<=)</option><option value="!=">等しくない (!=)</option><option value=">">より大きい (>)</option><option value="<">より小さい (<)</option></select></div>
            <div class="editor-group" style="flex:2;"><label>判定値:</label><input type="text" class="step-data" data-key="flagValue" value="3"></div>
        </div>
        <div style="display:flex; gap:5px; margin-top:5px;">
            <div class="editor-group" style="flex:1;"><label>条件を満たす時のジャンプ先:</label>${getSceneSelectUI("step-data", "true_next", "yes_route")}</div>
            <div class="editor-group" style="flex:1;"><label>満たさない時のジャンプ先:</label>${getSceneSelectUI("step-data", "false_next", "no_route")}</div>
        </div>`;
    else if (type === "end") content = `
        <div style="background:#f7fafc; padding:10px; border-radius:6px; border:1px solid #cbd5e0;">
            <label style="color:#2b6cb0; font-weight:bold; display:block; margin-bottom:5px;">🏁 エンディング・クリア後の挙動</label>
            
            <select class="step-data w-100 mb-2" data-key="clearMode" onchange="const root = this.parentElement; const loopOpts = root.querySelector('.loop-opts'); const hint = root.querySelector('.mode-hint'); if(this.value==='loop'){ loopOpts.style.display='block'; hint.innerText='【二周目】能力を引き継いで最初からやり直します。フラグと日数はリセットされます。'; hint.style.color='#dd6b20'; } else if(this.value==='keep'){ loopOpts.style.display='none'; hint.innerText='【後日談】フラグも日数もそのまま維持し、平和になった世界を冒険し続けます。'; hint.style.color='#38a169'; } else { loopOpts.style.display='none'; hint.innerText='【終了】セーブデータを完全に削除し、タイトル画面へ戻ります。'; hint.style.color='#718096'; }">
                <option value="delete">❌ データを消去してタイトルへ</option>
                <option value="loop" style="color:#dd6b20; font-weight:bold;">🔄 強くてニューゲーム (歴史をリセット)</option>
                <option value="keep" style="color:#38a169; font-weight:bold;">🚀 クリア後も続行 (現状を維持)</option>
            </select>

            <!-- 🌟 モード別の説明をリアルタイムで表示する欄 -->
            <div class="mode-hint" style="font-size:11px; font-weight:bold; margin-bottom:10px; min-height:1.5em; color:#718096;">
                挙動を選択してください。
            </div>
            
            <!-- Loop時のみ表示される引き継ぎ設定 -->
            <div class="loop-opts" style="display:none; background:#fffaf0; padding:10px; border:1px solid #d69e2e; border-radius:4px; margin-top:5px; margin-bottom:10px;">
                <label style="color:#dd6b20; font-weight:bold; display:block; margin-bottom:8px; border-bottom:1px solid #fbd38d;">🔄 引き継ぐ要素の選択</label>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <label style="cursor:pointer; font-size:12px;"><input type="checkbox" class="step-data" data-key="keepMoney" checked> 所持金・宝珠を持ち越す</label>
                    <label style="cursor:pointer; font-size:12px;"><input type="checkbox" class="step-data" data-key="keepItems" checked> アイテム・装備・秘伝書を持ち越す</label>
                    <label style="cursor:pointer; font-size:12px;"><input type="checkbox" class="step-data" data-key="keepChars" checked> 仲間・Lv・ステータスを持ち越す</label>
                </div>
                <div style="font-size:10px; color:#c05621; margin-top:8px; padding:5px; background:#fff; border-radius:4px;">
                    ※<b>フラグ(state.flags)</b>は、チェックに関わらず<br>
                    　二周目（Loop）では必ずリセットされます。
                </div>
            </div>

            <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #cbd5e0;">
                <label style="font-weight:bold; font-size:12px;">ジャンプ先 (周回の開始地点 / 続行の復帰地点):</label>
                ${getSceneSelectUI("step-data", "loopNext", "start")}
                <div style="font-size:11px; color:#e53e3e; margin-top:8px; font-weight:bold;">※ このノードを通過すると累計クリア回数が +1 されます。</div>
            </div>
        </div>`;
    return `<div class="step-block step-${type}" id="step-${index}"><div class="step-block-header"><span style="cursor: grab; user-select: none;">≡ [シナリオ] ${type.toUpperCase()}</span><div style="display:flex; gap:2px;"><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, -1)">▲</button><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, 1)">▼</button><button class="btn-toggle-step" onclick="toggleStep('step-${index}')"></button><button class="btn-info btn-sm" onclick="editorDuplicateStep('step-${index}')">複製</button><button class="btn-remove-step btn-danger btn-sm" onclick="editorRemoveElement('step-${index}')">削除</button></div></div><input type="hidden" class="step-type" value="${type}"><div class="step-body">${content}</div></div>`;
}

window.editorAddScene = function (sceneIdStr) {
    let sid = sceneIdStr;
    if (!sid) {
        const input = document.getElementById("new-scene-id");
        sid = input.value.trim();
        input.value = "";
    }
    if (!sid) sid = "scene_" + Date.now();

    if (document.getElementById(`scene-block-${sid}`)) {
        alert("そのシーンIDは既に存在します！"); return;
    }

    const html = `
        <div class="scene-block" id="scene-block-${sid}" data-scene-id="${sid}">
            <div class="scene-header" style="background:#edf2f7;">
                <span style="display:flex; align-items:center; gap:5px;">🎬 シーン: 
                    <input type="text" class="scene-id-input" value="${sid}" style="width:150px; font-weight:bold; color:var(--danger); font-family:monospace; padding:2px 5px; border:1px solid #cbd5e0; border-radius:4px;">
                </span>
                <!-- 🌟 ここを追加！：このシーンが終わった後に飛ぶ場所 -->
                <span style="display:flex; align-items:center; gap:5px; font-size:12px; color:#2b6cb0;">➡️ 終了遷移先: 
                    ${getSceneSelectUI("scene-next-input", "", "next_scene", true)}
                </span>
                <div class="btn-group">
                    <button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, -1)">▲</button>
                    <button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, 1)">▼</button>
                    <button class="btn-warning btn-sm" onclick="editorTestPlayScene('${sid}')">▶ テスト開始</button>
                    <button class="btn-cancel btn-sm" onclick="toggleScene('${sid}')">開閉</button>
                    <button class="btn-info btn-sm" onclick="editorDuplicateScene('${sid}')">複製</button>
                    <button class="btn-danger btn-sm" onclick="editorRemoveElement('scene-block-${sid}')">削除</button>
                </div>
            </div>
            <div class="scene-body" id="scene-body-${sid}">
                <div class="scene-step-list" id="edit-steps-${sid}"></div>
                <div class="add-buttons" style="border-top: 1px dashed #cbd5e0; padding-top: 10px;">
                    <button type="button" onclick="editorAddStep('system_set', '${sid}')">+ システム</button>
                    <button type="button" onclick="editorAddStep('msg', '${sid}')">+ メッセージ</button>
                    <button type="button" onclick="editorAddStep('choice', '${sid}')">+ 選択肢</button>
                    <button type="button" onclick="editorAddStep('dice_choice', '${sid}')">+ ダイス分岐</button>
                    <button type="button" onclick="editorAddStep('stat_roll', '${sid}')">+ キャラメイク</button>
                    <button type="button" onclick="editorAddStep('party_edit', '${sid}')">+ 預かり所(編成)</button>
<button type="button" onclick="editorAddStep('fusion', '${sid}')">+ 配合所(強化)</button>
                    <button type="button" onclick="editorAddStep('battle', '${sid}')">+ バトル判定</button>
                    <button type="button" onclick="editorAddStep('jump', '${sid}')">+ ジャンプ</button>
                    <button type="button" onclick="editorAddStep('shop', '${sid}')">+ ショップ</button>
                    <button type="button" onclick="editorAddStep('map', '${sid}')">+ マップ</button>
                    <button type="button" onclick="editorAddStep('stat_change', '${sid}')">+ 能力増減</button>
                    <button type="button" onclick="editorAddStep('job_change', '${sid}')">+ 転職(ジョブ)</button>
                    <button type="button" onclick="editorAddStep('join_party', '${sid}')">+ 仲間加入</button>
                    <button type="button" onclick="editorAddStep('minigame', '${sid}')">+ ミニゲーム</button>
                    <button type="button" onclick="editorAddStep('pass_time', '${sid}')">+ 時間経過</button>
                    <button type="button" onclick="editorAddStep('bg_set', '${sid}')">+ 背景指定</button>
                    <button type="button" onclick="editorAddStep('craft', '${sid}')">+ クラフト(合成)</button>
                    <button type="button" onclick="editorAddStep('give', '${sid}')">+ 入手/没収</button>
                    <button type="button" onclick="editorAddStep('flag_set', '${sid}')">+ フラグ設定</button>
                    <button type="button" onclick="editorAddStep('flag_check', '${sid}')">+ フラグ分岐</button>
                    <button type="button" onclick="editorAddStep('end', '${sid}')">+ END</button>
                </div>
            </div>
        </div>
    `;
    const container = document.getElementById("scenario-container");
    const div = document.createElement("div"); div.innerHTML = html;
    container.appendChild(div.firstElementChild);

    makeSortable(`edit-steps-${sid}`); // シーン内での並べ替えを有効化
    if (!isBatchLoading) updateDatalists();
    pushHistory();
};


// 特定のシーン枠の中にステップを追加する関数
window.editorAddStep = function (type, sceneId) {
    if (!sceneId) {
        const firstBlock = document.querySelector('.scene-block');
        if (firstBlock) sceneId = firstBlock.getAttribute('data-scene-id');
        else { alert("先に「+ シーン枠追加」を行ってください。"); return; }
    }
    const container = document.getElementById(`edit-steps-${sceneId}`);
    if (!container) return;

    const div = document.createElement("div");
    div.innerHTML = getStepHTML(type, stepIndexCount++);
    container.appendChild(div.firstElementChild);
    if (!isBatchLoading) updateDatalists();
    pushHistory();
};


// ★追加：味方キャラ入力フォーム
window.editorAddPlayer = function () {
    const index = playerIndexCount++;
    const content = `
        <div class="step-block" id="player-${index}">
            <div class="step-block-header"><span style="color:#27ae60; cursor: grab;">≡ [味方キャラ]</span><div style="display:flex; gap:2px;"><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, -1)">▲</button><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, 1)">▼</button><button class="btn-toggle-step" onclick="toggleStep('player-${index}')"></button><button class="btn-remove-step btn-danger btn-sm" onclick="editorRemoveElement('player-${index}')">削除</button></div></div>
            
            <div class="step-body">
                <!-- 1行目：基本情報 -->
                <div class="editor-group"><label>ID / 表示名:</label><input type="text" class="player-data" data-key="id" placeholder="my_hero" oninput="updateDatalists()"><input type="text" class="player-data" data-key="name" placeholder="主人公" oninput="updateDatalists()"></div>
                
                <!-- 2行目：配合レシピ -->
                <div style="display:flex; gap:5px; background:#faf5ff; padding:5px; border-radius:4px; border:1px solid #d6bcfa; margin-bottom:5px;">
                    <div class="editor-group" style="flex:1;"><label style="color:#553c9a; font-weight:bold;">🧬 配合レシピ (親1ID):</label><input type="text" class="player-data" data-key="recipe_parent1" placeholder="slime" list="enemy-list"></div>
                    <div class="editor-group" style="flex:1;"><label style="color:#553c9a; font-weight:bold;">🧬 配合レシピ (親2ID):</label><input type="text" class="player-data" data-key="recipe_parent2" placeholder="dragon" list="enemy-list"></div>
                </div>

                <!-- 3行目：死亡時イベント（赤枠） -->
                <div class="editor-group" style="background:#fff5f5; padding:8px; border-radius:4px; border:1px solid #fc8181; margin-bottom:5px;">
                    <label style="color:#c53030; font-weight:bold;">💀 死亡時イベント（HP0で中断して遷移）:</label>
            ${getSceneSelectUI("player-data", "death_scene", "遷移先のシーンID (空欄で通常死亡)")}
                    <div style="font-size:10px; color:#718096; margin-top:2px;">※「かばう」イベントや「覚醒」演出の再現に使えます。</div>
                </div>

                <!-- 4行目：メインステータス（3列） -->
                <!-- 🌟 修正：MPとSTの入力欄を追加した基本ステータス -->
                <div style="background:#f7fafc; padding:8px; border-radius:4px; border:1px solid #cbd5e0; margin-bottom:10px;">
                    <label style="color:#2b6cb0; font-weight:bold; display:block; margin-bottom:5px;">📊 基本ステータス（現在値 / 成長限界）</label>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:5px;">
                        <div class="editor-group"><label>最大HP / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="maxHp" value="120" title="現在値"><input type="number" class="player-data" data-key="limit_maxHp" value="999" title="限界値" style="background:#edf2f7; color:#4a5568;"></div></div>
                        <div class="editor-group"><label>最大MP / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="maxMp" value="50" title="現在値"><input type="number" class="player-data" data-key="limit_maxMp" value="500" title="限界値" style="background:#edf2f7; color:#4a5568;"></div></div>
                        <div class="editor-group"><label>最大ST / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="maxSt" value="100" title="現在値"><input type="number" class="player-data" data-key="limit_maxSt" value="500" title="限界値" style="background:#edf2f7; color:#4a5568;"></div></div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:5px;">
                        <div class="editor-group"><label>技(tech) / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="tech" value="60"><input type="number" class="player-data" data-key="limit_tech" value="100" style="background:#edf2f7; color:#4a5568;"></div></div>
                        <div class="editor-group"><label>経(exp) / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="exp" value="30"><input type="number" class="player-data" data-key="limit_exp" value="100" style="background:#edf2f7; color:#4a5568;"></div></div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="editor-group" style="flex:1;"><label>基礎攻撃力 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="baseDmg" value="15"><input type="number" class="player-data" data-key="limit_baseDmg" value="100" style="background:#edf2f7; color:#4a5568;"></div></div>
                        <div class="editor-group" style="flex:1;"><label>基礎防御力 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="baseDef" value="10"><input type="number" class="player-data" data-key="limit_baseDef" value="80" style="background:#edf2f7; color:#4a5568;"></div></div>
                    </div>
                </div>

                <!-- 5行目：コスト ＆ 特殊イベントジャンプ（紫枠） -->
                <div style="display:flex; gap:10px; align-items: stretch; margin-bottom:10px;">
                    <div class="editor-group" style="flex:1;"><label style="color:#e53e3e; font-weight:bold;">ユニットコスト:</label><input type="number" class="player-data" data-key="cost" value="10"></div>
                    <div class="editor-group" style="flex:2; background:#f5e6ff; padding:10px; border-radius:8px; border:1px solid #d6bcfa;">
                        <label style="color:#553c9a; font-weight:bold; font-size:12px; display:block; margin-bottom:4px;">🎭 技「※イベント発動」時のジャンプ先:</label>
            ${getSceneSelectUI("player-data", "trigger_scene", "遷移先のシーンID")}
                        <div style="font-size:10px; color:#718096; line-height:1.3; margin-top:5px;">※ 戦闘中に「sys_event_jump」を使うと指定シーンへ強制遷移。</div>
                    </div>
                </div>


                <!-- 以降：共通パーツ -->
                ${getTraitSelectUI('player')}
                
                <!-- 6行目：耐性ステータス（現在値 / 限界値） -->
                <div style="background:#fff5f5; padding:8px; border-radius:4px; border:1px solid #fc8181; margin-bottom:10px;">
                    <label style="color:#c53030; font-weight:bold; display:block; margin-bottom:5px;">🛡️ 耐性ステータス</label>
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <div class="editor-group" style="flex:1;"><label>MAX 衝撃 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="maxShock" value="60"><input type="number" class="player-data" data-key="limit_maxShock" value="300" style="background:#fed7d7;"></div></div>
                        <div class="editor-group" style="flex:1;"><label>MAX 熱量 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="maxHeat" value="60"><input type="number" class="player-data" data-key="limit_maxHeat" value="300" style="background:#fed7d7;"></div></div>
                        <div class="editor-group" style="flex:1;"><label>MAX 電磁 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="maxElec" value="60"><input type="number" class="player-data" data-key="limit_maxElec" value="300" style="background:#fed7d7;"></div></div>
                    </div>
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <div class="editor-group" style="flex:1;"><label>回復(REC) 衝撃 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="recShock" value="10"><input type="number" class="player-data" data-key="limit_recShock" value="30" style="background:#fed7d7;"></div></div>
                        <div class="editor-group" style="flex:1;"><label>回復(REC) 熱量 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="recHeat" value="10"><input type="number" class="player-data" data-key="limit_recHeat" value="30" style="background:#fed7d7;"></div></div>
                        <div class="editor-group" style="flex:1;"><label>回復(REC) 電磁 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="player-data" data-key="recElec" value="10"><input type="number" class="player-data" data-key="limit_recElec" value="30" style="background:#fed7d7;"></div></div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <div class="editor-group" style="flex:2;">
                            <label>攻(ATK) 衝/熱/電 (現在値):</label>
                            <div style="display:flex; gap:2px;">
                                <input type="number" class="player-data" data-key="atkShock" value="10" title="衝撃攻撃力">
                                <input type="number" class="player-data" data-key="atkHeat" value="5" title="熱量攻撃力">
                                <input type="number" class="player-data" data-key="atkElec" value="5" title="電磁攻撃力">
                            </div>
                        </div>
                        <div class="editor-group" style="flex:2;">
                            <label>攻(ATK) 衝/熱/電 (限界値):</label>
                            <div style="display:flex; gap:2px;">
                                <input type="number" class="player-data" data-key="limit_atkShock" value="100" style="background:#edf2f7; color:#4a5568;" title="衝撃攻撃力の限界">
                                <input type="number" class="player-data" data-key="limit_atkHeat" value="100" style="background:#edf2f7; color:#4a5568;" title="熱量攻撃力の限界">
                                <input type="number" class="player-data" data-key="limit_atkElec" value="100" style="background:#edf2f7; color:#4a5568;" title="電磁攻撃力の限界">
                            </div>
                        </div>
                        <div class="editor-group" style="flex:1;">
                            <label>復旧(REV) 衝/熱/電:</label>
                            <div style="display:flex; gap:2px;">
                                <input type="number" class="player-data" data-key="revShock" value="2">
                                <input type="number" class="player-data" data-key="revHeat" value="2">
                                <input type="number" class="player-data" data-key="revElec" value="2">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="editor-group" style="background:#ebf8ff; padding:8px; border-radius:4px; margin-top:10px; border:1px solid #90cdf4;">
                    <label style="color:#2b6cb0; font-weight:bold;">📈 レベルアップで覚える技 (レベル:技ID):</label>
                    <input type="text" class="player-data skill-input" data-key="level_skills" placeholder="5:fire_1, 12:mega_heal" list="skill-list" oninput="appendSkillFromList(this)">
                </div>

                <div class="editor-group" style="margin-top:10px;">
                    <label>初期習得済みの技 (カンマ区切り / 候補から選択可):</label>
                    <input type="text" class="player-data skill-input" data-key="skills" placeholder="fire_1, heal_1" list="skill-list" oninput="appendSkillFromList(this)">
                </div>
                ${getAffinityUI('player')}
${getMultiFaceAA_UI('player')}

            </div>
        </div>`;
    const div = document.createElement("div"); div.innerHTML = content; document.getElementById("edit-players").appendChild(div.firstElementChild);
    if (!isBatchLoading) updateDatalists();
    pushHistory();
};

window.editorAddEnemy = function () {
    const index = enemyIndexCount++;
    const content = `
        <div class="step-block" id="enemy-${index}">
            <div class="step-block-header"><span style="color:#e67e22; cursor: grab;">≡ [敵データ]</span><div style="display:flex; gap:2px;"><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, -1)">▲</button><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, 1)">▼</button><button class="btn-toggle-step" onclick="toggleStep('enemy-${index}')"></button><button class="btn-remove-step btn-danger btn-sm" onclick="editorRemoveElement('enemy-${index}')">削除</button></div></div>
            <div class="step-body">
            <div class="editor-group"><label>ID / 表示名:</label><input type="text" class="enemy-data" data-key="id" placeholder="custom_enemy" oninput="updateDatalists()"><input type="text" class="enemy-data" data-key="name" placeholder="真・魔王"></div>
            <div style="display:flex; gap:5px;">
                <div class="editor-group"><label>HP / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="hp" value="100"><input type="number" class="enemy-data" data-key="limit_maxHp" value="999" style="background:#edf2f7; color:#4a5568;"></div></div>
                <div class="editor-group"><label>技 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="tech" value="50"><input type="number" class="enemy-data" data-key="limit_tech" value="100" style="background:#edf2f7; color:#4a5568;"></div></div>
                <div class="editor-group"><label>経 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="exp" value="50"><input type="number" class="enemy-data" data-key="limit_exp" value="100" style="background:#edf2f7; color:#4a5568;"></div></div>
            </div>
            <div style="display:flex; gap:5px; margin-top:5px;">
                <div class="editor-group"><label>基攻 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="baseDmg" value="10"><input type="number" class="enemy-data" data-key="limit_baseDmg" value="100" style="background:#edf2f7; color:#4a5568;"></div></div>
                <div class="editor-group"><label>基防 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="baseDef" value="5"><input type="number" class="enemy-data" data-key="limit_baseDef" value="80" style="background:#edf2f7; color:#4a5568;"></div></div>
                <div class="editor-group"><label>装備品:</label><select class="enemy-data equip-helper-select" data-key="equip"><option value="">なし</option></select></div>
            </div>

            ${getTraitSelectUI('enemy')}
            <div style="display:flex; gap:5px;"><div class="editor-group"><label>ボス耐性 (割合Dや強制異常・即死・強奪を無効化):</label><select class="enemy-data" data-key="isBoss"><option value="false">通常敵</option><option value="true" style="color:red; font-weight:bold;">あり (ボス)</option></select></div></div>
            
            <!-- 💰 報酬設定エリア -->
            <div style="background:#f0fff4; padding:8px; border-radius:4px; border:1px solid #9ae6b4; margin-bottom:5px;">
                <div style="display:flex; gap:5px; margin-bottom:5px;">
                    <div class="editor-group" style="flex:1;"><label>ドロップG:</label><input type="number" class="enemy-data" data-key="dropMoney" value="100"></div>
                    <div class="editor-group" style="flex:1;"><label>ドロップEXP:</label><input type="number" class="enemy-data" data-key="dropExp" value="50"></div>
                </div>

                <!-- 🌟 追加：アイテムドロップ設定 -->
                <div style="display:flex; gap:5px;">
                    <div class="editor-group" style="flex:2;">
                        <label style="color:#276749; font-weight:bold;">🎁 ドロップアイテム (ID):</label>
                        <input type="text" class="enemy-data" data-key="dropItem" placeholder="heal_1" list="item-list">
                    </div>
                    <div class="editor-group" style="flex:1;">
                        <label style="color:#276749; font-weight:bold;">確率 (%):</label>
                        <input type="number" class="enemy-data" data-key="dropRate" value="0" min="0" max="100" title="0で落とさない、100で確実">
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:5px; margin-top:5px;">
                <div class="editor-group" style="flex:1;"><label>MAX 衝撃 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="maxShock" value="50"><input type="number" class="enemy-data" data-key="limit_maxShock" value="300" style="background:#fed7d7;"></div></div>
                <div class="editor-group" style="flex:1;"><label>MAX 熱量 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="maxHeat" value="50"><input type="number" class="enemy-data" data-key="limit_maxHeat" value="300" style="background:#fed7d7;"></div></div>
                <div class="editor-group" style="flex:1;"><label>MAX 電磁 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="maxElec" value="50"><input type="number" class="enemy-data" data-key="limit_maxElec" value="300" style="background:#fed7d7;"></div></div>
            </div>
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <div class="editor-group" style="flex:1;"><label>回復(REC) 衝撃 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="recShock" value="10"><input type="number" class="enemy-data" data-key="limit_recShock" value="30" style="background:#fed7d7;"></div></div>
                <div class="editor-group" style="flex:1;"><label>回復(REC) 熱量 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="recHeat" value="10"><input type="number" class="enemy-data" data-key="limit_recHeat" value="30" style="background:#fed7d7;"></div></div>
                <div class="editor-group" style="flex:1;"><label>回復(REC) 電磁 / 限界:</label><div style="display:flex; gap:2px;"><input type="number" class="enemy-data" data-key="recElec" value="10"><input type="number" class="enemy-data" data-key="limit_recElec" value="30" style="background:#fed7d7;"></div></div>
            </div>
            <div style="display:flex; gap:5px; margin-bottom:5px;">
                <div class="editor-group" style="flex:2;">
                    <label>攻(ATK) 衝/熱/電 (現在値):</label>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="enemy-data" data-key="atkShock" value="10">
                        <input type="number" class="enemy-data" data-key="atkHeat" value="5">
                        <input type="number" class="enemy-data" data-key="atkElec" value="5">
                    </div>
                </div>
                <div class="editor-group" style="flex:2;">
                    <label>攻(ATK) 衝/熱/電 (限界値):</label>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="enemy-data" data-key="limit_atkShock" value="100" style="background:#edf2f7; color:#4a5568;">
                        <input type="number" class="enemy-data" data-key="limit_atkHeat" value="100" style="background:#edf2f7; color:#4a5568;">
                        <input type="number" class="enemy-data" data-key="limit_atkElec" value="100" style="background:#edf2f7; color:#4a5568;">
                    </div>
                </div>
            </div>
            ${getAffinityUI('enemy')}
            ${getMultiFaceAA_UI('enemy')}

            <div class="editor-group" style="background:#eebefa; padding:8px; border-radius:4px; margin-top:5px; border:1px solid #d6bcfa;">
                <label style="color:#553c9a; font-weight:bold;">🎭 ギミックイベント（戦闘中に特定の行動をされた時に中断してジャンプ）:</label>
                <div style="display:flex; gap:5px;">
                    <input type="text" class="enemy-data" data-key="trigger_id" placeholder="反応する技・装備・アイテムのID" style="flex:1;">
                    ${getSceneSelectUI("enemy-data", "trigger_scene", "遷移先のシーンID")}
                </div>
                <div style="font-size:10px; color:#718096; margin-top:4px; line-height:1.4;">
                    ※ 敵に特定の技・武器で攻撃した時だけでなく、<b>戦闘中に特定のアイテムを使った瞬間</b>にも発動します。
                </div>
            </div>
            <div class="editor-group" style="background:#fff5f5; padding:8px; border-radius:4px; margin-top:5px; border:1px solid #fc8181;">
                <label style="color:#c53030; font-weight:bold;">💀 死亡時イベント（HP0になった瞬間に戦闘を中断してジャンプ）:</label>
                ${getSceneSelectUI("enemy-data", "death_scene", "遷移先のシーンID (空欄なら普通に死ぬ)")}
            </div>

            <div class="editor-group">
                <div class="editor-group" style="background:#edf2f7; padding:8px; border-radius:4px; margin-top:5px; border:1px solid #cbd5e0;">
                    <label style="color:#2b6cb0; font-weight:bold; border-bottom:1px solid #cbd5e0; padding-bottom:4px; margin-bottom:8px; display:block;">🗺️ 盤面での動き方（移動AI）</label>
                    <div style="display:flex; gap:10px; margin-bottom:15px;">
                        <div style="flex:1;">
                            <span style="font-size:11px; color:#4a5568;">基本の移動方針:</span>
                            <select class="enemy-data w-100" data-key="ai_move_type" style="padding:4px;">
                                <option value="closest">猛攻（一番近い相手を狙う）</option>
                                <option value="weakest">暗殺（HPが一番低い相手を狙う）</option>
                                <option value="healer">支援（傷ついた味方/敵軍 に近づく）</option>
                                <option value="stay">不動（自分の初期位置から動かない）</option>
                                <option value="coward">臆病（相手から逃げるように動く）</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <span style="font-size:11px; color:#4a5568;">ピンチ時の行動変化:</span>
                            <select class="enemy-data w-100" data-key="ai_move_pinch" style="padding:4px;">
                                <option value="none">変化なし（最後まで戦う）</option>
                                <option value="escape_25" style="color:#e53e3e;">HP25%以下で「臆病(逃走)」に変化</option>
                                <option value="escape_50" style="color:#e53e3e;">HP50%以下で「臆病(逃走)」に変化</option>
                            </select>
                        </div>
                    </div>

                    <label style="color:#e53e3e; font-weight:bold; border-bottom:1px solid #cbd5e0; padding-bottom:4px; margin-bottom:8px; display:block;">⚔️ 戦闘中の技の選び方（上から順に判定）</label>
                    <div class="ai-cards-container" style="display:flex; flex-direction:column; gap:5px; margin-bottom:8px;"></div>
                    <button type="button" class="btn-success btn-sm w-100 mb-2" onclick="addAiCard(this)">＋ 新しい行動条件を追加</button>

                    <div style="display:flex; align-items:center; gap:5px; background:#fff; padding:6px; border-radius:4px; border:1px solid #e2e8f0; border-left:4px solid #3182ce;">
                        <span style="font-size:11px; font-weight:bold; color:#3182ce; width:40px; text-align:center;">基本</span>
                        <input type="text" class="enemy-data skill-input" data-key="act_base_skill" value="normal" list="skill-list" placeholder="技IDを入力" style="flex:2; padding:4px; font-size:12px; border:1px solid #cbd5e0; border-radius:4px;">
                        <span style="font-size:11px;">を</span>
                        <input type="number" class="enemy-data" data-key="act_base_prob" value="50" style="width:50px; padding:4px; text-align:right; font-size:12px; border:1px solid #cbd5e0; border-radius:4px;">
                        <span style="font-size:11px;">%で使い、外れたら</span>
                        <input type="text" class="enemy-data skill-input" data-key="act_base_skill2" value="none" list="skill-list" placeholder="noneで何もしない" style="flex:2; padding:4px; font-size:12px; border:1px solid #cbd5e0; border-radius:4px;">
                    </div>
                    
                    <input type="hidden" class="enemy-data" data-key="ai_cards" value="[]">
                    <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #cbd5e0;">
                        <label style="font-size:11px; color:#4a5568;">💡 スカウト（配合）時に引き継がれる技：</label>
                        <div style="display:flex; gap:5px;">
                            <input type="text" class="enemy-data skill-input w-100" data-key="skills" placeholder="fire_1, heal_1等" list="skill-list" oninput="appendSkillFromList(this)" style="background:#edf2f7; color:#2b6cb0; font-weight:bold; border:1px solid #cbd5e0; padding:6px; border-radius:4px;">
                            <button type="button" class="btn-info btn-sm" style="white-space:nowrap;" onclick="cleanupEnemySkills(this)">🧹 使ってない技を消去</button>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>`;
    const div = document.createElement("div"); div.innerHTML = content; document.getElementById("edit-enemies").appendChild(div.firstElementChild);
    if (!isBatchLoading) updateDatalists();
    pushHistory();
};

window.editorAddItem = function () {
    const index = itemIndexCount++;
    const content = `
        <div class="step-block" id="item-${index}">
            <div class="step-block-header"><span style="color:#8e44ad; cursor: grab;">≡ [アイテム/装備/秘伝書]</span><div style="display:flex; gap:2px;"><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, -1)">▲</button><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, 1)">▼</button><button class="btn-toggle-step" onclick="toggleStep('item-${index}')"></button><button class="btn-remove-step btn-danger btn-sm" onclick="editorRemoveElement('item-${index}')">削除</button></div></div>
            <div class="step-body">
                <div class="editor-group"><label>ID / 表示名:</label><input type="text" class="item-data" data-key="id" placeholder="my_item" oninput="updateDatalists()"><input type="text" class="item-data" data-key="name" placeholder="伝説の剣" oninput="updateDatalists()"></div>
                
                <!-- 🌟 修正：種類に「秘伝書」を追加し、選んだら下の表示を切り替える -->
               <div style="display:flex; gap:10px;">
                    <div class="editor-group" style="flex:1;">
                        <label>種類:</label>
                        <select class="item-data" data-key="type" onchange="window.toggleItemEditorUI(this); updateDatalists()">
                            <option value="equip">装備品</option>
                            <option value="consumable">消費アイテム</option>
                            <option value="skill_book">📜 秘伝書 (技を覚えさせる)</option>
                        </select>
                    </div>
                    <div class="editor-group" style="flex:1; display:flex; align-items:center; justify-content:center; background:#fffaf0; border:1px solid #d69e2e; border-radius:4px;">
                        <label style="cursor:pointer; color:#dd6b20; font-weight:bold; margin:0;">
                            <input type="checkbox" class="item-data" data-key="isGlobal" style="margin-right:5px;"> 👑 貴重品 (周回持越し)
                        </label>
                    </div>
                </div>

                <div class="editor-group"><label>価格 (G):</label><input type="number" class="item-data" data-key="price" value="500"></div>
                <div class="editor-group"><label>説明文:</label><input type="text" class="item-data" data-key="desc"></div>

                <!-- 🌟 追加：秘伝書を選んだ時だけ表示されるエリア -->
                <div class="item-book-fields" style="display:none; background:#faf5ff; padding:10px; border-radius:4px; border:2px solid #9f7aea; margin-bottom:10px;">
                    <label style="color:#553c9a; font-weight:bold;">📜 覚えさせる技のID:</label>
                    <input type="text" class="item-data w-100 mb-2" data-key="teaches_skill" placeholder="fire_slash" style="padding:5px;">
                    
                    <!-- 🌟 追加：使用制限の入力欄 -->
                    <label style="color:#553c9a; font-weight:bold;">👤 使用可能なキャラID (カンマ区切り / 空欄で無制限):</label>
                    <input type="text" class="item-data w-100" data-key="usable_ids" placeholder="yaruo, yaranaiuo" list="player-id-list" style="padding:5px;">
                    <div style="font-size:10px; color:#718096; margin-top:4px;">※ 特定のキャラにだけ覚えさせたい場合は、そのキャラのIDを入力してください。</div>
                </div>

                <!-- 🌟 追加：装備品・消費アイテムの時だけ表示されるエリア（今までのステータス群を丸ごと囲む） -->
                <div class="item-normal-fields">
                    ${getElementSelectUI('item')} 
                    ${getStatusSelectUI('item')}
                    ${getResistStatusSelectUI('item')}
                    ${getAffinityUI('item')}
                    
                    <div style="display:flex; gap:5px; background:#ebf8ff; padding:5px; border-radius:4px; border:1px solid #90cdf4; margin-bottom:5px;">
                        <div class="editor-group" style="flex:2;">
                            <label style="color:#2b6cb0; font-weight:bold;">🔨 合成レシピ (素材ID:個数, 素材ID:個数):</label>
                            <input type="text" class="item-data" data-key="recipe" placeholder="herb:2, water:1 | h_herb:1" title="「|」記号で区切ると、別ルートのレシピも登録できます！">
                            <div style="font-size:10px; color:#3182ce; margin-top:2px;">※「|」で区切ると複数の作成ルートが並びます。</div>
                        </div>
                        <div class="editor-group" style="flex:1;"><label style="color:#2b6cb0;">カテゴリ (例:料理):</label><input type="text" class="item-data" data-key="craft_category" placeholder="料理"></div>
                    </div>

                     <div style="display:flex; gap:5px;">
                        <div class="editor-group" style="flex:1;"><label>技/経/射程:</label>
                            <div style="display:flex; gap:2px;">
                                <input type="number" class="item-data" data-key="addTech" value="0" title="技UP">
                                <input type="number" class="item-data" data-key="addExp" value="0" title="経UP">
                                <input type="number" class="item-data" data-key="range" value="1" min="1" title="タクティカル射程">
                            </div>
                        </div>
                        <div class="editor-group" style="flex:1;"><label>基攻/基防:</label>
                            <div style="display:flex; gap:2px;">
                                <input type="number" class="item-data" data-key="addDmg" value="0">
                                <input type="number" class="item-data" data-key="addDef" value="0">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 🌟 ここを追加！ -->
                    <div style="display:flex; gap:5px;"><div class="editor-group"><label>最大MP/ST UP:</label><div style="display:flex; gap:2px;"><input type="number" class="item-data" data-key="addMaxMp" value="0" title="最大MPアップ"><input type="number" class="item-data" data-key="addMaxSt" value="0" title="最大STアップ"></div></div></div>
                    
                    <div style="display:flex; gap:5px;"><div class="editor-group"><label>属性攻 衝/熱/電:</label><div style="display:flex; gap:2px;"><input type="number" class="item-data" data-key="atkShock" value="0"><input type="number" class="item-data" data-key="atkHeat" value="0"><input type="number" class="item-data" data-key="atkElec" value="0"></div></div></div>
                    <div style="display:flex; gap:5px;"><div class="editor-group"><label>MAX耐性UP 衝/熱/電:</label><div style="display:flex; gap:2px;"><input type="number" class="item-data" data-key="addMaxShock" value="0"><input type="number" class="item-data" data-key="addMaxHeat" value="0"><input type="number" class="item-data" data-key="addMaxElec" value="0"></div></div></div>
                    
                    <div style="display:flex; gap:5px;">
                        <div class="editor-group" style="flex:2;">
                            <label>特殊効果:</label>
                            <select class="item-data" data-key="effect">
                                <option value="">なし (装備品など)</option>
                                <option value="heal">HP回復</option>
                                <option value="heal_mp">MP回復</option>
                                <option value="heal_st">ST回復</option>
                                <option value="cure_status">状態異常を全回復</option>
                                <option value="escape">確実に逃走</option>
                                <option value="rec_res">耐性の全復旧</option>
                                <option value="guarantee_hit">次攻撃が必中</option>
                                <option value="transform_crit">次攻撃が命中時クリティカル</option>
                                <option value="guarantee_dodge">次被弾を1回無効化</option>
                                <option value="counter">カウンター発動</option>
                                <option value="buff">全能力バフ</option>
                                <option value="damage_fixed">固定ダメージ</option>
                                <option value="res_up">耐性減少を半分に抑える</option>
                            </select>
                        </div>
                        <div class="editor-group" style="flex:1;">
                            <label>効果値(回復/ダメ量):</label>
                            <input type="number" class="item-data" data-key="effectPower" value="0">
                        </div>
                    </div>

                    <div class="editor-group" style="background:#eebefa; padding:8px; border-radius:4px; margin-top:5px;">
                        <label style="color:#553c9a; font-weight:bold;">自動発動 (条件を満たすと装備を消費して発動):</label>
                        <select class="item-data" data-key="auto_trigger" style="width:100%; padding:4px;">
                            <option value="">なし (通常の装備品)</option>
                            <option value="on_death">HPが0になる時 (HP1で耐える)</option>
                            <option value="on_weak">弱点を受けた時 (全耐性が全快する)</option>
                            <option value="on_status">状態異常を受けた時 (即座に回復する)</option>
                            <option value="on_break_shock">衝撃ブレイク時 (衝撃耐性が全快する)</option>
                            <option value="on_break_heat">熱量ブレイク時 (熱量耐性が全快する)</option>
                            <option value="on_break_elec">電磁ブレイク時 (電磁耐性が全快する)</option>
                            <option value="on_break">いずれかのブレイク時 (全耐性全快＋指定した状態異常の代償)</option>
                        </select>
                    </div>
                </div> <!-- /item-normal-fields -->

                <div class="editor-group"><label>アイコンAA:</label><textarea class="item-data aa-input" data-key="aa" rows="6" oninput="updateAAPreview(this)"></textarea><pre class="aa-preview"></pre></div>
            </div>
        </div>`;
    const div = document.createElement("div"); div.innerHTML = content; document.getElementById("edit-items").appendChild(div.firstElementChild);
    if (!isBatchLoading) updateDatalists();
    pushHistory();
};

// 🌟 追加：秘伝書の時に不要な入力欄を隠す関数（editor.js内のどこかに追加）
window.toggleItemEditorUI = function (selectEl) {
    const block = selectEl.closest('.step-block');
    if (!block) return;
    const isBook = (selectEl.value === "skill_book");
    
    const normalFields = block.querySelector('.item-normal-fields');
    const bookFields = block.querySelector('.item-book-fields');
    
    if (normalFields) normalFields.style.display = isBook ? "none" : "block";
    if (bookFields) bookFields.style.display = isBook ? "block" : "none";
};
window.editorAddSkill = function () {
    const index = skillIndexCount++;
    const content = `
        <div class="step-block" id="skill-${index}">
<div class="step-block-header"><span style="color:#e74c3c; cursor: grab;">≡ [技データ]</span><div style="display:flex; gap:2px;"><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, -1)">▲</button><button class="btn-custom btn-sm" style="padding:2px 8px;" onclick="moveElement(this, 1)">▼</button><button class="btn-toggle-step" onclick="toggleStep('skill-${index}')"></button><button class="btn-remove-step btn-danger btn-sm" onclick="editorRemoveElement('skill-${index}')">削除</button></div></div>
            <div class="step-body">
            <div class="editor-group"><label>ID / 技名:</label><input type="text" class="skill-data" data-key="id" placeholder="my_skill" oninput="updateDatalists()"><input type="text" class="skill-data" data-key="name" placeholder="究極奥義" oninput="updateDatalists()"></div>
            <div class="editor-group"><label>説明文:</label><input type="text" class="skill-data" data-key="desc"></div>
<div class="editor-group"><label>対象範囲:</label><select class="skill-data" data-key="target_type">
                <option value="enemy_single">敵単体 (通常)</option>
                <option value="enemy_all">敵全体 (AoE攻撃)</option>
                <option value="ally_single">味方単体 (回復・補助)</option>
                <option value="ally_all">味方全体 (回復・補助)</option>
                <option value="self">自分自身</option>
                <option value="field_all" style="color:#e53e3e; font-weight:bold;">敵味方全体 (フィールド全体)</option>
            </select></div>
            ${getElementSelectUI('skill')} 

            <!-- 🌟 追加：消費MPと消費STの入力欄 -->
            <div style="display:flex; gap:5px; background:#faf5ff; padding:5px; border-radius:4px; border:1px solid #d6bcfa; margin-bottom:5px;">
                <div class="editor-group" style="flex:1;"><label style="color:#9f7aea; font-weight:bold;">🔮 消費魔力 (MP):</label><input type="number" class="skill-data" data-key="cost_mp" value="0" min="0"></div>
                <div class="editor-group" style="flex:1;"><label style="color:#ed8936; font-weight:bold;">🏃 消費スタミナ (ST):</label><input type="number" class="skill-data" data-key="cost_st" value="0" min="0"></div>
            </div>

            <div style="display:flex; gap:5px;"><div class="editor-group" style="flex:1;"><label>ダメ倍率:</label><input type="number" class="skill-data" data-key="dmg_mod" value="1.0" step="0.1"></div><div class="editor-group" style="flex:1;"><label>戦闘D倍率:</label><input type="number" class="skill-data" data-key="battle_dice_mod" value="1.0" step="0.1"></div><div class="editor-group" style="flex:1;"><label>命中D補正:</label><input type="number" class="skill-data" data-key="hit_dice_mod" value="0"></div></div>
            
            <label style="color:#e67e22; font-weight:bold; font-size:12px; margin-top:5px; display:block;">🔥 ブレイク（耐性削り）性能</label>
            <div style="display:flex; gap:5px; background:#fffaf0; padding:5px; border-radius:4px; border:1px solid #ed8936;">
                <div class="editor-group" style="flex:1;"><label>衝/熱/電 (倍率):</label>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="skill-data" data-key="mod_shock" value="1.0" step="0.1" title="衝撃削り倍率">
                        <input type="number" class="skill-data" data-key="mod_heat" value="1.0" step="0.1" title="熱量削り倍率">
                        <input type="number" class="skill-data" data-key="mod_elec" value="1.0" step="0.1" title="電磁削り倍率">
                    </div>
                </div>
                <div class="editor-group" style="flex:1;"><label>衝/熱/電 (固定加算):</label>
                    <div style="display:flex; gap:2px;">
                        <input type="number" class="skill-data" data-key="add_shock" value="0" title="衝撃固定ダメージ">
                        <input type="number" class="skill-data" data-key="add_heat" value="0" title="熱量固定ダメージ">
                        <input type="number" class="skill-data" data-key="add_elec" value="0" title="電磁固定ダメージ">
                    </div>
                </div>
            </div>
            <div style="font-size:10px; color:#718096; margin-bottom:5px;">※ 実際の削り量 ＝ (自分の属性ATK × 倍率) ＋ 固定加算値</div>

            <div style="display:flex; gap:5px;"><div class="editor-group"><label>反動ダメージ (HP/衝/熱/電):</label><div style="display:flex; gap:2px;"><input type="number" class="skill-data" data-key="recoil_hp" value="0" placeholder="HP"><input type="number" class="skill-data" data-key="recoil_shock" value="0" placeholder="衝"><input type="number" class="skill-data" data-key="recoil_heat" value="0" placeholder="熱"><input type="number" class="skill-data" data-key="recoil_elec" value="0" placeholder="電"></div></div></div>
            
            ${getStatusSelectUI('skill')}

            <!-- 技専用の特殊効果設定に戻しました -->
            <div class="editor-group" style="background:#eebefa; padding:8px; border-radius:4px; margin-top:5px;">
                <label style="color:#553c9a; font-weight:bold;">特殊効果 (ダメージ計算の代わりに発動):</label>
                <select class="skill-data" data-key="special_effect">
                    <option value="">なし</option>
                    <option value="sync_hp">痛み分け (自分のHP割合を相手に同期させる)</option>
                    <option value="sync_res">耐性同調 (自分の耐性割合を相手に同期させる)</option>
                    <option value="transfer_status">異常転移 (自分の状態異常を対象になすりつける)</option>
                    <option value="escape_battle">戦線離脱 (はぐれメタル・撤退イベント用)</option>
                    <option value="charge_1">1ターン溜める (ソーラービーム型: 1T目溜め, 2T目発動)</option>
        <option value="recharge_1">使用後行動不能 (破壊光線型: 攻撃後、次のターン動けない)</option>
                <option value="cure_status">状態異常を完全に回復</option>
                    <option value="rec_res">耐性ブレイクを復旧し全回復</option>
                </select>
                <div style="font-size:10px; color:#718096; margin-top:4px;">※特殊効果はダメージ計算を無視して、割合や状態異常を操作します。<br>※「状態異常回復」と「HP回復量」を同時に設定すると複合技になります。</div>
            </div>
            </div>
            </div>
        </div>`;
    const div = document.createElement("div"); div.innerHTML = content; document.getElementById("edit-skills").appendChild(div.firstElementChild);
    if (!isBatchLoading) updateDatalists();
    pushHistory();
};

// 🟢 editor.js に追加：複数表情対応のAA入力UIコンポーネント
function getMultiFaceAA_UI(prefix) {
    // 内部的にJSON文字列として保存し、UI上はタブで切り替えて編集させる
    return `
    <div class="editor-group" style="border: 2px solid #cbd5e0; border-radius: 8px; padding: 10px; background: #f7fafc; margin-bottom: 10px;">
        <label style="font-weight:bold; color:#2b6cb0; margin-bottom:8px; display:block;">🎨 AA設定 (パス指定 または 直接入力)</label>
        
        <!-- 隠しフィールド：ここにオブジェクトをJSON化した文字列を保存する -->
        <input type="hidden" class="${prefix}-data multi-aa-storage" data-key="aa" value='{"通常":""}'>
        
        <div style="font-size:11px; color:#718096; margin-bottom:10px;">
            💡 <b>[CHARACTER.YARUO]</b> のような「パス」を入力すると、システムが自動で表情を切り替えます。<br>
            自分でAAを直書きする場合は、下のタブを切り替えて状況ごとのAAを貼り付けてください。
        </div>

        <div class="multi-aa-tabs" style="display:flex; gap:2px; margin-bottom:5px;">
            <button type="button" class="btn-primary btn-sm active" style="flex:1; border-radius:4px 4px 0 0;" onclick="switchAAFace(this, '通常')">😊 通常</button>
            <button type="button" class="btn-cancel btn-sm" style="flex:1; border-radius:4px 4px 0 0;" onclick="switchAAFace(this, '攻撃')">⚔️ 攻撃</button>
            <button type="button" class="btn-cancel btn-sm" style="flex:1; border-radius:4px 4px 0 0;" onclick="switchAAFace(this, 'ダメージ')">💥 被弾</button>
            <button type="button" class="btn-cancel btn-sm" style="flex:1; border-radius:4px 4px 0 0;" onclick="switchAAFace(this, 'ピンチ')">💦 ピンチ</button>
        </div>
        
        <!-- 現在のタブの状態を保持する隠し属性 -->
        <div class="multi-aa-editor" data-current-face="通常">
            <textarea class="aa-input w-100" rows="6" placeholder="AAのパス(例: CHARACTER.YARUO) または AAを直接貼り付け" 
                style="border-radius:0 0 4px 4px; border:1px solid #cbd5e0; border-top:none;" 
                oninput="updateMultiAA(this)"></textarea>
            <pre class="aa-preview" style="margin-top:5px; background:#1a202c; color:#e2e8f0; padding:10px; border-radius:4px; font-size:10px; min-height:80px;"></pre>
        </div>
    </div>`;
}

// 🌟 AAタブの切り替え処理
window.switchAAFace = function(btnEl, faceKey) {
    const container = btnEl.closest('.editor-group');
    const storage = container.querySelector('.multi-aa-storage');
    const editor = container.querySelector('.multi-aa-editor');
    const textarea = editor.querySelector('.aa-input');
    
    // タブの見た目変更
    container.querySelectorAll('.multi-aa-tabs button').forEach(b => {
        b.className = "btn-cancel btn-sm";
    });
    btnEl.className = "btn-primary btn-sm active";
    
    // データを取り出す
    let aaData = {};
    try { aaData = JSON.parse(storage.value || '{}'); } catch(e) { aaData = { "通常": storage.value }; }
    
    // 現在の入力を保存してから、新しいタブのテキストをセットする
    const currentFace = editor.getAttribute('data-current-face');
    aaData[currentFace] = textarea.value;
    storage.value = JSON.stringify(aaData);
    
    editor.setAttribute('data-current-face', faceKey);
    
    // 🌟 パス指定（.を含み改行がない）の場合は、他のタブを切り替えても同じパスを表示し続ける親切設計
    let newText = aaData[faceKey] || "";
    if (!newText && aaData["通常"] && aaData["通常"].includes('.') && !aaData["通常"].includes('\n')) {
        newText = aaData["通常"]; 
    }
    
    textarea.value = newText;
    
    // プレビューの更新
    updateMultiAA(textarea);
};

// 🌟 テキストエリア入力時の保存とプレビュー更新
window.updateMultiAA = function(textarea) {
    const container = textarea.closest('.editor-group');
    const storage = container.querySelector('.multi-aa-storage');
    const editor = container.querySelector('.multi-aa-editor');
    const currentFace = editor.getAttribute('data-current-face');
    
    // データ更新
    let aaData = {};
    try { aaData = JSON.parse(storage.value || '{}'); } catch(e) { aaData = { "通常": "" }; }
    aaData[currentFace] = textarea.value;
    storage.value = JSON.stringify(aaData);
    
    // プレビュー更新（既存の関数を流用）
    updateAAPreview(textarea);
    
    // 変更を履歴に記録
    if (typeof updateDatalists === 'function') updateDatalists();
    if (typeof pushHistory === 'function') pushHistory();
};

window.editorRemoveElement = function (id) {
    if (!confirm("本当に削除しますか？\n（この操作は元に戻せません）")) return;
    
    const el = document.getElementById(id);
    if (el) {
        // 🌟 追加：画面から消す前に、その要素が持っていたIDを取得してメモリから消す
        if (el.classList.contains("scene-block")) {
            const sid = el.getAttribute("data-scene-id");
            if (sid && SCENARIO[sid]) delete SCENARIO[sid];
        } else if (id.startsWith("enemy-")) {
            const eid = el.querySelector(".enemy-data[data-key='id']")?.value;
            if (eid && ENEMY_MASTER[eid]) delete ENEMY_MASTER[eid];
        } else if (id.startsWith("item-")) {
            const iid = el.querySelector(".item-data[data-key='id']")?.value;
            if (iid && ITEMS[iid]) delete ITEMS[iid];
        } else if (id.startsWith("skill-")) {
            const sid = el.querySelector(".skill-data[data-key='id']")?.value;
            if (sid && SKILLS[sid]) delete SKILLS[sid];
        }
        
        el.remove(); // 画面から消す
    }
    updateDatalists(); // 予測変換リストを更新
    pushHistory();
};

let datalistTimeout = null;

// 🌟 修正：既存の updateDatalists の中身を、遅延実行（デバウンス）でラップする
window.updateDatalists = function () {
    // すでにタイマーが動いていればキャンセル
    if (datalistTimeout) clearTimeout(datalistTimeout);

    datalistTimeout = setTimeout(() => {
    // 1. 敵リストのサジェスト（画面上の敵データのみ！）
    let enemyOpts = "";
    document.querySelectorAll(".enemy-data[data-key='id']").forEach(i => {
        if (i.value.trim()) enemyOpts += `<option value="${i.value.trim()}">`;
    });
    document.getElementById("enemy-list").innerHTML = enemyOpts;

    // 2. シーンリストのサジェスト（画面上のシーン枠のみ！）
    let sceneOpts = `<option value="">▼</option>`; 
    document.querySelectorAll(".scene-block").forEach(block => {
        const sid = block.getAttribute('data-scene-id');
        if (sid) sceneOpts += `<option value="${sid}">${sid}</option>`;
    });

    // 既存の <datalist id="scene-list"> を更新（▼を選ぶ という文字は除外）
    let sceneDatalist = document.getElementById("scene-list");
    if (sceneDatalist) {
        sceneDatalist.innerHTML = sceneOpts.replace(/<option value="">▼ 選ぶ<\/option>/g, ""); 
    }

    // 🌟 追加：すべての ▼ プルダウンの中身を最新のシーン一覧に更新
    document.querySelectorAll(".scene-helper-select").forEach(sel => {
        sel.innerHTML = sceneOpts;
        sel.value = ""; // 見た目は常に「▼」にしておく
    });

    // 3. 話者（キャラクター名）のサジェスト（システム＋画面上のキャラのみ！）
    let charOpts = ""; 
    document.querySelectorAll(".player-data[data-key='name']").forEach(i => { if (i.value) charOpts += `<option value="${i.value}">`; });
    document.querySelectorAll(".enemy-data[data-key='name']").forEach(i => { if (i.value) charOpts += `<option value="${i.value}">`; });
    document.getElementById("char-list").innerHTML = charOpts;

    // 4. 技の選択肢（画面上の技データのみ！）
    let skillOpts = `
        <option value="normal" label="通常攻撃">
        <option value="nothing" label="様子を見る (何もしない)">
        <option value="sys_event_jump" label="※イベント発動(戦闘中断して遷移)">
    `;
    let selectOpts = `
        <option value="normal" style="font-weight:bold; color:#2b6cb0;">通常攻撃</option>
        <option value="nothing" style="font-weight:bold; color:#718096;">様子を見る (何もしない)</option>
        <option value="sys_event_jump" style="font-weight:bold; color:#805ad5;">※イベント発動(戦闘中断して遷移)</option>
    `;
    document.querySelectorAll(".skill-data[data-key='id']").forEach(i => {
        const sid = i.value.trim();
        if (sid) {
            const nameInput = i.closest('.step-block').querySelector(".skill-data[data-key='name']");
            const sname = nameInput && nameInput.value ? nameInput.value : sid;
            // 🌟 修正：datalist用（手入力補完用）とselect用（プルダウン用）の両方を作る
            skillOpts += `<option value="${sid}" label="${sname}">`;
            selectOpts += `<option value="${sid}">${sname}</option>`;
        }
    });

    // 🌟 追加：datalist (skill-list) を更新
    const sList = document.getElementById("skill-list");
    if (sList) sList.innerHTML = skillOpts;

    // 既存のセレクトボックス（敵AI用など）の更新
    document.querySelectorAll(".skill-helper-select").forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = selectOpts;
        sel.value = currentVal;
    });

    // 5. 装備品の選択肢（画面上の装備アイテムのみ！）
    let equipOpts = `<option value="">なし</option>`;
    document.querySelectorAll(".item-data[data-key='id']").forEach(i => {
        if (i.value) {
            const typeSelect = i.closest('.step-block').querySelector(".item-data[data-key='type']");
            if (typeSelect && typeSelect.value === "equip") {
                const nameInput = i.closest('.step-block').querySelector(".item-data[data-key='name']");
                const iname = nameInput && nameInput.value ? nameInput.value : i.value;
                equipOpts += `<option value="${i.value}">${iname}</option>`;
            }
        }
    });
    document.querySelectorAll(".equip-helper-select").forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = equipOpts;
        sel.value = currentVal;
    });

    // 6. 味方IDのサジェスト（画面上の味方データのみ！）
    let playerIdOpts = "";
    // 🌟修正：画面に入力されているIDだけを拾う
    document.querySelectorAll(".player-data[data-key='id']").forEach(i => { 
        if (i.value.trim()) playerIdOpts += `<option value="${i.value.trim()}">`; 
    });
    const pList = document.getElementById("player-id-list");
    if (pList) pList.innerHTML = playerIdOpts;
 let playerHelperOpts = `<option value="">▼</option>` + playerIdOpts;
    document.querySelectorAll(".scene-helper-select[data-list-type='player']").forEach(sel => {
        sel.innerHTML = playerHelperOpts;
        sel.value = ""; 
    });
    // 7. 全アイテムIDのサジェスト (クラフト目標設定用)
let allItemOpts = "";
    document.querySelectorAll(".item-data[data-key='id']").forEach(i => {
        if (i.value) allItemOpts += `<option value="${i.value.trim()}">`;
    });
    let itemList = document.getElementById("item-list");
    if (!itemList) {
        itemList = document.createElement("datalist"); 
        itemList.id = "item-list"; 
        document.body.appendChild(itemList);
    }
    itemList.innerHTML = allItemOpts;

    let statKeyOpts = `
        <option value="hp" label="現在の HP">
        <option value="mp" label="現在の 魔力(MP)">
        <option value="st" label="現在の スタミナ(ST)">
        <option value="sp" label="スキルポイント (SP)">
        <option value="money" label="所持金 (全体)">
        <option value="orb_shinsei" label="新生の宝珠 (全体)">
        <option value="maxHp" label="最大HP">
        <option value="maxMp" label="最大MP">
        <option value="maxSt" label="最大ST">
        <option value="tech" label="技術 (tech)">
        <option value="exp" label="経験 (exp)">
        <option value="baseDmg" label="基礎攻撃力">
        <option value="baseDef" label="基礎防御力">
        <option value="atkShock" label="衝攻 (ATK)">
        <option value="atkHeat" label="熱攻 (ATK)">
        <option value="atkElec" label="電攻 (ATK)">
    `;
    let statKeyList = document.getElementById("stat-key-list");
    if (!statKeyList) {
        statKeyList = document.createElement("datalist"); 
        statKeyList.id = "stat-key-list"; 
        document.body.appendChild(statKeyList);
    }
    statKeyList.innerHTML = statKeyOpts;

    // 赤色警告用（画面上のシーンIDのみ！）
    const validSceneIds = new Set();
    document.querySelectorAll(".scene-block").forEach(block => {
        const sid = block.getAttribute('data-scene-id');
        if (sid) validSceneIds.add(sid);
    });

    const targetKeys = ["win", "lose", "escape", "scout", "next", "c1_next", "c2_next", "opt1_next", "opt2_next", "true_next", "false_next", "failScene", "trueNext", "falseNext"];

    document.querySelectorAll(".step-data").forEach(inp => {
        const key = inp.getAttribute("data-key");
        if (targetKeys.includes(key)) {
            const validateInput = () => {
                const val = inp.value.trim();
                if (val !== "" && !validSceneIds.has(val)) {
                    inp.style.backgroundColor = "#fed7d7";
                    inp.style.borderColor = "#e53e3e";
                    inp.title = "⚠️ このシーンIDは存在しません！タイポに注意！";
                } else {
                    inp.style.backgroundColor = "";
                    inp.style.borderColor = "";
                    inp.title = "";
                }
            };
            inp.oninput = validateInput;
            inp.onchange = updateDatalists;
        }
    });

    // AAサジェスト（ここは変更なし）
    let aaOpts = "";
    if (typeof AA_MAP !== 'undefined') {
        for (let key in AA_MAP) { aaOpts += `<option value="${key}.">`; }
    }
    let aaList = document.getElementById("aa-list");
    if (!aaList) { aaList = document.createElement("datalist"); aaList.id = "aa-list"; document.body.appendChild(aaList); }
    aaList.innerHTML = aaOpts;
    document.querySelectorAll(".aa-input").forEach(inp => { inp.setAttribute("list", "aa-list"); });

    if (typeof refreshFlowchartData === 'function') refreshFlowchartData();
    }, 500); // 0.5秒間、新たな入力がなければ実行
};



function getEditorJSONData() {
    const finalJSON = {};
    finalJSON.VERSION = "1.1.0";
    const titleInput = document.getElementById("project-title-input");
    if (titleInput && titleInput.value) {
        finalJSON.PROJECT_TITLE = titleInput.value.trim();
    }
    const playerBlocks = document.querySelectorAll("#edit-players .step-block");
    if (playerBlocks.length > 0) {
        finalJSON.PLAYER_TEAM = [];
        playerBlocks.forEach(block => {
            const inputs = block.querySelectorAll(".player-data"); let p = { level: 1, levelExp: 0, equip: null };
            inputs.forEach(input => {
                const key = input.getAttribute("data-key");
                if (["maxHp", "maxMp", "maxSt", "tech", "exp", "baseDmg", "baseDef", "cost", "maxShock", "maxHeat", "maxElec", "recShock", "recHeat", "recElec", "revShock", "revHeat", "revElec", "atkShock", "atkHeat", "atkElec",
     "limit_maxHp", "limit_maxMp", "limit_maxSt", "limit_tech", "limit_exp", "limit_baseDmg", "limit_baseDef", "limit_maxShock", "limit_maxHeat", "limit_maxElec", "limit_recShock", "limit_recHeat", "limit_recElec",
     "limit_atkShock", "limit_atkHeat", "limit_atkElec"].includes(key)) p[key] = Number(input.value) || 0;

                else if (key === "skills") p[key] = input.value.split(',').map(s => s.trim()).filter(s => s);
                else if (key === "trait") p[key] = input.value;
                else if (key === "death_scene") p[key] = input.value;
                else if (key === "trigger_scene") p[key] = input.value;
                else if (key === "aa") {
    try {
        let aaObj = JSON.parse(input.value);
        let encodedObj = {};
        for (let face in aaObj) {
            encodedObj[face] = window.encodeAA(aaObj[face]);
        }
        p[key] = encodedObj;
    } catch(e) {
        p[key] = window.encodeAA(input.value); // 古い形式のフォールバック
    }
}
                else p[key] = input.value;
            });
            p.hp = p.maxHp; finalJSON.PLAYER_TEAM.push(p);
        });
    }

    const enemyBlocks = document.querySelectorAll("#edit-enemies .step-block");
    if (enemyBlocks.length > 0) {
        finalJSON.ENEMY_MASTER = {};
        enemyBlocks.forEach(block => {
            const inputs = block.querySelectorAll(".enemy-data"); let e = {}; let eid = `custom_enemy_${Date.now()}`;
            inputs.forEach(input => {
                const key = input.getAttribute("data-key");
                if (key === "id" && input.value) eid = input.value;
                else if (["hp", "tech", "exp", "baseDmg", "baseDef", "dropMoney", "dropExp", "dropRate", "maxShock", "maxHeat", "maxElec",  "recShock", "recHeat", "recElec", "revShock", "revHeat", "revElec", "atkShock", "atkHeat", "atkElec",
          "limit_maxHp", "limit_tech", "limit_exp", "limit_baseDmg", "limit_baseDef", "limit_maxShock", "limit_maxHeat", "limit_maxElec", "limit_recShock", "limit_recHeat", "limit_recElec" // 🌟追加
         ].includes(key)) e[key] = Number(input.value) || 0;
                else if (key === "ai_move_type") e[key] = input.value;
                else if (key === "ai_move_pinch") e[key] = input.value;
                else if (key === "skills") e[key] = input.value.split(',').map(s => s.trim()).filter(s => s);
                else if (key === "trait") e[key] = input.value;
                else if (key === "death_scene") e[key] = input.value;
               else if (key === "aa") {
    try {
        let aaObj = JSON.parse(input.value);
        let encodedObj = {};
        for (let face in aaObj) {
            encodedObj[face] = window.encodeAA(aaObj[face]);
        }
        e[key] = encodedObj;
    } catch(e) {
        e[key] = window.encodeAA(input.value);
    }
}
                else if (key === "ai_cards") e[key] = JSON.parse(input.value || "[]");
                else e[key] = input.value;
            });
            e.maxHp = e.hp; finalJSON.ENEMY_MASTER[eid] = e;
        });
    }

    const itemBlocks = document.querySelectorAll("#edit-items .step-block");
    if (itemBlocks.length > 0) {
        finalJSON.ITEMS = {};
        itemBlocks.forEach(block => {
            const inputs = block.querySelectorAll(".item-data"); 
            let item = {}; 
            let iid = `custom_item_${Date.now()}`;
            
            inputs.forEach(input => {
                const key = input.getAttribute("data-key");
                if (key === "id" && input.value) iid = input.value;
                
                // 🌟 修正：チェックボックス（貴重品）か数値か文字列かで振り分ける
                if (key === "isGlobal") {
                    item[key] = input.checked;
                } else if (["price", "addTech", "addExp", "addDmg", "addDef", "atkShock", "atkHeat", "atkElec", "effectPower", "addMaxShock", "addMaxHeat", "addMaxElec", "range", "addMaxMp", "addMaxSt"].includes(key)) {
                    item[key] = Number(input.value) || 0;
                } else if (key === "aa") {
                    item[key] = window.encodeAA(input.value); 
                } else {
                    item[key] = input.value;
                }
            });
            item.id = iid; 
            finalJSON.ITEMS[iid] = item;
        });
    }

    const skillBlocks = document.querySelectorAll("#edit-skills .step-block");
    if (skillBlocks.length > 0) {
        finalJSON.SKILLS = {};
        skillBlocks.forEach(block => {
            const inputs = block.querySelectorAll(".skill-data"); let skill = {}; let sid = `custom_skill_${Date.now()}`;
            inputs.forEach(input => {
                const key = input.getAttribute("data-key");
                if (key === "id" && input.value) sid = input.value;
                else if (["dmg_mod", "battle_dice_mod", "hit_dice_mod", "mod_shock", "mod_heat", "mod_elec", "add_shock", "add_heat", "add_elec", "recoil_hp", "recoil_shock", "recoil_heat", "recoil_elec", "heal_hp", "cost_mp", "cost_st"].includes(key)) skill[key] = Number(input.value) || 0;
                else skill[key] = input.value;
            });
            skill.id = sid; finalJSON.SKILLS[sid] = skill;
        });
    }

    const sceneBlocks = document.querySelectorAll("#scenario-container .scene-block");
    if (sceneBlocks.length > 0) {
        finalJSON.SCENARIO = {};
        sceneBlocks.forEach(sceneBlock => {
    // 🌟 修正：属性タグ(data-scene-id)ではなく、入力欄(scene-id-input)の値を直接見る
    const idInput = sceneBlock.querySelector(".scene-id-input");
    const sceneId = idInput ? idInput.value.trim() : (sceneBlock.getAttribute("data-scene-id") || `scene_${Date.now()}`);
            let stepsArray = [];
            const stepBlocks = sceneBlock.querySelectorAll(".scene-step-list .step-block");

            stepBlocks.forEach(block => {
                const typeInput = block.querySelector(".step-type");
                if (!typeInput) return; // 構造が壊れていたらスキップ
                
                const type = typeInput.value;
                const inputs = block.querySelectorAll(".step-data");
                let stepObj = { type: type };

                // 値を安全に取得するヘルパー関数
                const getVal = (index, fallback = "") => inputs[index] ? inputs[index].value.trim() : fallback;
                const getNum = (index, fallback = 0) => inputs[index] && inputs[index].value !== "" ? Number(inputs[index].value) : fallback;
                const getBool = (index, fallback = true) => inputs[index] ? inputs[index].checked : fallback;
                // 配列（カンマ区切り）を安全に生成。空欄ならfallbackの配列を返す
                const getArr = (index, fallback = []) => {
                    const val = getVal(index);
                    return val ? val.split(",").map(s => s.trim()).filter(s => s) : fallback;
                };

                // ① getEditorJSONData 内の type === "system_set" の保存部分
                if (type === "system_set") {
                    stepObj.enableLevelUp = getBool(0);
                    stepObj.enableResistance = getBool(1);
                    stepObj.enableAttribute = getBool(2);
                    stepObj.enableStatus = getBool(3);
                    stepObj.enablePartyBattle = getBool(4);
                    stepObj.enableTactical = getBool(5);
                    stepObj.enableAnalyze = getBool(6);
                    stepObj.skipHitDice = getBool(7);
                    stepObj.enableItemUse = getBool(8);
                    stepObj.enableEquipChange = getBool(9);
                    stepObj.enableEscape = getBool(10);
                    stepObj.enableScout = getBool(11);
                    stepObj.enableTimeSystem = getBool(12);
                    stepObj.enablePermaDeath = getBool(13);
                    stepObj.enableSpReset = getBool(14);
                    stepObj.enableMultiEquip = getBool(15);
                    stepObj.enableTension = getBool(16);
                    stepObj.enableMpSt = getBool(17); 
                    stepObj.enableEvolution = getBool(18); // 🌟 追加
                    
                    // 数値入力は19番目からスタートにズレる
                    stepObj.maxLevel = getNum(19, 0); 
                    stepObj.maxItemCount = getNum(20, 0);
                    stepObj.maxSkills = getNum(21, 0); 
                    stepObj.maxPlayerCount = getNum(22, 50);
                    stepObj.battleMemberCount = getNum(23, 3); 
                    stepObj.maxEquipCount = getNum(24, 1); 
                    stepObj.timeLimit = getNum(25, 0); 
                    stepObj.turnLimit = getNum(26, 0);
                    stepObj.maxPartyCost = getNum(27, 0);
                }

// ② getEditorJSONData 内の skillBlocks（技）の保存部分

                else if (type === "msg") { 
                    stepObj.speaker = getVal(0, "システム"); // 話者が空ならシステムに
                    stepObj.aa = window.encodeAA(getVal(1)); // JSON文字列としてエンコード
                    stepObj.text = getVal(2, "（メッセージが未設定です）"); 
                }
                else if (type === "choice") { 
                    stepObj.choices = []; 
                    if (getVal(0)) stepObj.choices.push({ text: getVal(0), next: getVal(1, "start") }); 
                    if (getVal(2)) stepObj.choices.push({ text: getVal(2), next: getVal(3, "start") }); 
                    if (getVal(4)) stepObj.choices.push({ text: getVal(4), next: getVal(5, "start") }); 
                    if (getVal(6)) stepObj.choices.push({ text: getVal(6), next: getVal(7, "start") }); 
                    // 選択肢が1つも作られなかった場合のフェイルセーフ
                    if (stepObj.choices.length === 0) stepObj.choices.push({ text: "次へ", next: "start" });
                }

                 else if (type === "battle") { 
                    stepObj.enemies = getArr(0, ["custom_enemy"]);
                    stepObj.initiative = getVal(1, "stats");
                    stepObj.mapData = getVal(2, "");
                    stepObj.win = getVal(3, ""); 
                    stepObj.lose = getVal(4, "start"); 
                    stepObj.draw = getVal(5, ""); 
                    stepObj.escape = getVal(6, ""); 
                    stepObj.scout = getVal(7, ""); 
                }
                else if (type === "jump") { 
                    stepObj.next = getVal(0, sceneId); 
                }
                else if (type === "shop") { 
                    stepObj.items = getArr(0, ["heal_1"]); 
                }
                else if (type === "give") { 
                    stepObj.target = getVal(0, "money"); 
                    stepObj.amount = getNum(1, 1); 
                }
                else if (type === "flag_set") { 
                    stepObj.targetId = getVal(0); 
                    stepObj.flagName = getVal(1, "dummy_flag"); 
                    stepObj.operator = getVal(2, "="); 
                    stepObj.flagValue = getVal(3, "1"); 
                }
                else if (type === "flag_check") { 
                    stepObj.targetId = getVal(0); 
                    stepObj.flagName = getVal(1, "dummy_flag"); 
                    stepObj.condition = getVal(2, "=="); 
                    stepObj.flagValue = getVal(3, "1"); 
                    stepObj.true_next = getVal(4, sceneId); 
                    stepObj.false_next = getVal(5, sceneId); 
                }
                else if (type === "stat_change") { 
                    stepObj.targetId = getVal(0, "all"); 
                    stepObj.mode = getVal(1, "recover"); // 🌟 追加：モード
                    stepObj.statKey = getVal(2, "hp"); 
                    let amt = getVal(3, "10");
                    stepObj.amount = isNaN(Number(amt)) ? amt : Number(amt);
                    stepObj.msg = getVal(4); 
                }else if (type === "job_change") {
                    stepObj.targetId = getVal(0, "");
                    stepObj.jobId = getVal(1, "");
                }
                else if (type === "join_party") {
                    // 番号(0, 1)ではなく、設定した data-key を直接探して読み取る
                    const idInp = block.querySelector('.step-data[data-key="targetId"]');
                    const msgInp = block.querySelector('.step-data[data-key="msg"]');
                    stepObj.targetId = idInp ? idInp.value.trim() : "";
                    stepObj.msg = msgInp ? msgInp.value.trim() : "";
                }
                else if (type === "minigame") { 
                    stepObj.gameType = getVal(0, "slot"); 
                    stepObj.mgTitle = getVal(1);
                    stepObj.betType = getVal(2, "money"); 
                    stepObj.targetId = getVal(3); 
                    stepObj.betAmount = getNum(4, 0); 
                    stepObj.playLimit = getNum(5, 0); 
                    stepObj.nextScene = getVal(6, sceneId); 
                    stepObj.failScene = getVal(7, sceneId); 
                    stepObj.requireSuccess = getBool(8, false); 
                    stepObj.difficulty = getNum(9, 3); 
                    stepObj.rewards = getVal(10); 
                }
                else if (type === "pass_time") { 
                    stepObj.amount = getNum(0, 1); 
                    stepObj.msg = getVal(1); 
                }
                else if (type === "craft") { 
                    stepObj.title = getVal(0, "アトリエ"); 
                    stepObj.category = getVal(1); 
                    stepObj.targetItem = getVal(2); 
                    stepObj.targetCount = getNum(3, 1); 
                    stepObj.trueNext = getVal(4, sceneId); 
                    stepObj.falseNext = getVal(5, sceneId); 
                }
                else if (type === "bg_set") { 
                    stepObj.preset = getVal(0, "auto"); 
                    stepObj.custom_bg = getVal(1, "auto"); 
                    stepObj.textColor = getVal(2, "auto"); 
                    stepObj.msgBg = getVal(3, "rgba(0,0,0,0.85)");
                    stepObj.msgText = getVal(4, "#ffffff");
                    stepObj.msgSpeaker = getVal(5, "#ecc94b");
                }
                else if (type === "dice_choice") { 
                    stepObj.speaker = getVal(0, "システム"); 
                    stepObj.aa = window.encodeAA(getVal(1)); 
                    stepObj.text = getVal(2, "判定"); 
                    stepObj.diceMax = getNum(3, 100); 
                    stepObj.options = []; 
                    if (getVal(4) !== "") stepObj.options.push({ min: getNum(4, 0), max: getNum(5, 50), next: getVal(6, sceneId) }); 
                    if (getVal(7) !== "") stepObj.options.push({ min: getNum(7, 51), max: getNum(8, 100), next: getVal(9, sceneId) }); 
                }
                else if (type === "stat_roll") { 
                    stepObj.speaker = getVal(0, "システム"); 
                    stepObj.aa = window.encodeAA(getVal(1)); 
                    stepObj.text = getVal(2, "ダイスロール！"); 
                    stepObj.targetId = getVal(3, "yaruo"); 
                    stepObj.rerolls = getNum(4, 0); 
                    
                    stepObj.rolls = [];
                    // 5枠分のデータを配列に詰める
                    [5, 7, 9, 11, 13].forEach(idx => {
                        let key = getVal(idx, "none");
                        let exp = getVal(idx + 1, "1d100+10");
                        if (key !== "none") stepObj.rolls.push({ key: key, exp: exp });
                    });
                }
                else if (type === "map") {
                    stepObj.viewType = getVal(0, "top");
                    stepObj.mapData = getVal(1, "..........");
                    stepObj.events = getVal(2, "");
                }else if (type === "end") {
                    stepObj.clearMode = getVal(0, "delete");
                    stepObj.keepMoney = getBool(1, true);
                    stepObj.keepItems = getBool(2, true);
                    stepObj.keepChars = getBool(3, true);
                    stepObj.loopNext = getVal(4, "start");
                }
                stepsArray.push(stepObj);
            });
            const nextInput = sceneBlock.querySelector(".scene-next-input");
            if (nextInput && nextInput.value.trim() !== "") {
                stepsArray.push({ type: "jump", next: nextInput.value.trim() });
            }
            finalJSON.SCENARIO[sceneId] = stepsArray;
        });
    }
    if (window.flowchartLayout && Object.keys(window.flowchartLayout).length > 0) {
        // 例: "start:2,5|boss:-1,8" のような短い文字列にパッキング
        const layoutStr = Object.entries(window.flowchartLayout)
            .map(([k, v]) => `${k}:${v.x},${v.y}`)
            .join('|');
        finalJSON.FLOWCHART_LAYOUT = layoutStr;
    }
    return { json: finalJSON, sceneId: sceneBlocks.length > 0 ? sceneBlocks[0].getAttribute("data-scene-id") : null };

}

window.editorGenerateJSON = function () { document.getElementById("editor-output").value = JSON.stringify(getEditorJSONData().json, null, 2); };
window.editorCopyJSON = function () { const output = document.getElementById("editor-output"); if (!output.value) { alert("先に「JSON生成」を押してね"); return; } output.select(); document.execCommand("copy"); alert("コピーしました！"); };

window.exportProjectToFile = function () {
    const dataObj = getEditorJSONData();
    if (!dataObj || !dataObj.json.SCENARIO || Object.keys(dataObj.json.SCENARIO).length === 0) {
        alert("書き出すデータがありません！"); return;
    }

    // 🌟 追加：保存時にファイル名を任意で設定できるプロンプト
    const titleInput = document.getElementById("project-title-input");
    const defaultTitle = (titleInput && titleInput.value) ? titleInput.value : "anko_quest";
    let safeTitle = prompt("保存するJSONファイルの名前を入力してください", defaultTitle);
    
    if (safeTitle === null) return; // キャンセルされたら保存を中止
    
    safeTitle = safeTitle.trim().replace(/[\\/:*?"<>|]/g, "_") || "anko_quest";

    // シナリオの圧縮処理
    if (dataObj.json.SCENARIO) {
        dataObj.json.SCENARIO = packScenario(dataObj.json.SCENARIO);
    }

    const dataStr = JSON.stringify(dataObj.json, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${safeTitle}.json`; // 🌟 設定した名前で保存
    a.click();
    URL.revokeObjectURL(url);
};




window.editorTestPlayScene = function (sceneId) {
    const data = getEditorJSONData();
    if (!data.json.SCENARIO || !data.json.SCENARIO[sceneId]) {
        alert("❌ そのシーンにステップがありません！"); return;
    }

    const scenario = data.json.SCENARIO;
    const allSceneIds = Object.keys(scenario);
    let errorMsgs =[];

    // 🌟 修正：二重になっていたループを1つにまとめ、全てのジャンプ条件を網羅する
    allSceneIds.forEach(sid => {
        if (!scenario[sid] || scenario[sid].length === 0) {
            errorMsgs.push(`・シーン【${sid}】の中身がカラッポです！`);
            return;
        }

        let hasEndOrJump = false; // シーンがちゃんと終わるか（フリーズしないか）のチェック用

        scenario[sid].forEach((step, idx) => {
            const stepLabel = `シーン【${sid}】のステップ${idx + 1}`;

            const checkLink = (targetId, typeName) => {
                if (targetId && !allSceneIds.includes(targetId)) {
                    errorMsgs.push(`・${stepLabel} (${typeName}) のジャンプ先「${targetId}」が存在しません！`);
                }
            };

            // 各ステップのリンクと「終了地点か」をチェック
            if (step.type === "jump") { checkLink(step.next, "ジャンプ"); hasEndOrJump = true; }
            if (step.type === "choice" && step.choices) { step.choices.forEach(c => checkLink(c.next, "選択肢")); hasEndOrJump = true; }
            if (step.type === "battle") { checkLink(step.win, "勝利"); checkLink(step.lose, "敗北"); checkLink(step.draw, "相打ち"); checkLink(step.escape, "逃走"); checkLink(step.scout, "捕獲"); hasEndOrJump = true; }
            if (step.type === "flag_check") { checkLink(step.true_next, "条件クリア"); checkLink(step.false_next, "条件未達"); hasEndOrJump = true; }
            if (step.type === "dice_choice" && step.options) { step.options.forEach(o => checkLink(o.next, "ダイス分岐")); hasEndOrJump = true; }
            
            // 🌟 修正：ミニゲームとクラフトも「終了地点」として認識させる
            if (step.type === "minigame") { checkLink(step.nextScene, "成功"); checkLink(step.failScene, "失敗"); hasEndOrJump = true; }
            if (step.type === "craft") { checkLink(step.trueNext, "達成"); checkLink(step.falseNext, "未達成"); hasEndOrJump = true; }
            
            if (step.type === "end") hasEndOrJump = true;

            if (step.type === "map") {
                hasEndOrJump = true; 
                if (step.events) {
                    step.events.split(",").forEach(e => {
                        let parts = e.split(":");
                        // 🌟 修正：%確率表記 (20%battle_wild) からシーン名だけを取り出してチェック
                        if (parts.length >= 2) {
                            let dest = parts[1].trim();
                            if (dest.includes('%')) dest = dest.split('%')[1].trim();
                            checkLink(dest, `マップイベント '${parts[0].trim()}'`);
                        }
                    });
                }
            }

            // 参照エラーのチェック
            if (step.type === "battle") {
                if (!step.enemies || step.enemies.length === 0) errorMsgs.push(`・${stepLabel} に出現する敵が設定されていません！`);
                else step.enemies.forEach(eId => {
                    if (!data.json.ENEMY_MASTER || !data.json.ENEMY_MASTER[eId]) errorMsgs.push(`・${stepLabel} で指定された敵「${eId}」のデータが存在しません！`);
                });
            }
            if (step.type === "give") {
                // 🌟 修正：お金などは「能力増減(stat_change)」に統一されたためエラーを出す
                if (["money", "exp", "orb_shinsei"].includes(step.target)) {
                    errorMsgs.push(`・${stepLabel} (入手/没収) で「${step.target}」が指定されています。（※お金やパラメータの増減は『能力増減(stat_change)』ステップを使用してください）`);
                } else if (!data.json.ITEMS || !data.json.ITEMS[step.target]) {
                    errorMsgs.push(`・${stepLabel} (入手/没収) で指定されたアイテム「${step.target}」が存在しません！`);
                }
            }
            if (step.type === "join_party") {
                // 🌟 修正：エディタ上に無ければ、ゲームの初期データ(INITIAL_PLAYER_TEAM)の中も探しにいく！
                const teamData = (data.json.PLAYER_TEAM && data.json.PLAYER_TEAM.length > 0) ? data.json.PLAYER_TEAM : (window.customPlayerTeam || INITIAL_PLAYER_TEAM);
                if (!teamData.some(p => p.id === step.targetId)) {
                    errorMsgs.push(`・${stepLabel} で指定された味方「${step.targetId}」が存在しません！`);
                }
            }
            if (step.type === "job_change") {
                let exists = false;
                const teamData = (data.json.PLAYER_TEAM && data.json.PLAYER_TEAM.length > 0) ? data.json.PLAYER_TEAM : (window.customPlayerTeam || INITIAL_PLAYER_TEAM);
                if (teamData.some(p => p.id === step.jobId)) exists = true;
                if (data.json.ENEMY_MASTER && data.json.ENEMY_MASTER[step.jobId]) exists = true;
                if (!exists && step.jobId) errorMsgs.push(`・${stepLabel} で指定されたジョブ「${step.jobId}」が存在しません！`);
            }
        });

        // 🌟 修正：フリーズ警告
        if (!hasEndOrJump && scenario[sid].length > 0) {
            errorMsgs.push(`・シーン【${sid}】の最後に、「ジャンプ」や「選択肢」など次の展開へ進むステップがありません！（ここでゲームがフリーズします）`);
        }
    });

    if (errorMsgs.length > 0) {
        // 🌟修正：強制終了ではなく、確認ダイアログ（confirm）にして「無理やり実行」できるようにする
        const proceed = confirm("🚨 【警告：進行不能になる可能性のあるエラーを発見しました】\n\n" + errorMsgs.join("\n") + "\n\nこのままテストプレイを強行しますか？\n（※エラー箇所に到達するとタイトル画面に戻されます）");

        if (!proceed) {
            // 「キャンセル」を選んだ場合のみ、警告のために画面を揺らして中止する
            const container = document.querySelector(".editor-main");
            if (container) {
                container.classList.add("shake");
                setTimeout(() => container.classList.remove("shake"), 300);
            }
            return; // 進行をブロック
        }
    }

    // エラーがない、または「強行する」を選んだ場合はテスト開始
    if (data.json.SCENARIO) Object.assign(SCENARIO, data.json.SCENARIO);
    if (data.json.ENEMY_MASTER) Object.assign(ENEMY_MASTER, data.json.ENEMY_MASTER);
    if (data.json.ITEMS) Object.assign(ITEMS, data.json.ITEMS);
    if (data.json.SKILLS) Object.assign(SKILLS, data.json.SKILLS);
    
    // 🌟修正：味方キャラが0人（空配列）でも、そのまま反映させる
    window.customPlayerTeam = data.json.PLAYER_TEAM ? data.json.PLAYER_TEAM : [];

    state.isTestPlay = true;
    document.getElementById("btn-exit-test").style.display = "block";

    // 🌟 修正：テストプレイ時も、味方マスターリストの「一番上のキャラ」だけを初期パーティに入れる
    let sourceTeam = window.customPlayerTeam && window.customPlayerTeam.length > 0 ? window.customPlayerTeam : INITIAL_PLAYER_TEAM;
    state.player = [JSON.parse(JSON.stringify(sourceTeam[0]))]; // 先頭の1人だけ
    state.player.forEach(p => p.originalId = p.id);
    state.money = 9999;
    state.inventory = { heal_1: 5, smoke_1: 5, sniper_1: 5, decoy_1: 5, coolant_1: 5 };
    state.ownedEquips = ["sw_1", "ax_1", "sp_1", "df_1"];

    alert(`【テストプレイ開始】\nシーン: ${sceneId}`);
    jumpTo(sceneId);
};

window.editorTestPlay = function () {
    const data = getEditorJSONData();
    if (!data.json.SCENARIO) { alert("シナリオがありません！"); return; }
    const firstSceneId = Object.keys(data.json.SCENARIO)[0];
    if (!firstSceneId) { alert("シナリオがありません！"); return; }
    editorTestPlayScene(firstSceneId);
};
function makeSortable(containerId) {
    const container = document.getElementById(containerId); if (!container) return;
    let dragEl = null;

    container.addEventListener('dragstart', (e) => {
        // 入力欄やセレクトボックスからのドラッグは無視する（文字選択を優先）
        if (e.target.closest('input, textarea, select')) {
            e.preventDefault();
            return;
        }

        // ブロック全体ではなく「ヘッダー（step-block-header）」を掴んでいるかチェック
        // または、ヘッダー内の文字/アイコンを掴んでいる場合も考慮
        const header = e.target.closest('.step-block-header, .scene-header');
        if (!header) {
            e.preventDefault();
            return;
        }

        dragEl = e.target.closest('.step-block, .scene-block');
        if (!dragEl) return;

        e.dataTransfer.effectAllowed = 'move';
        dragEl.style.opacity = '0.4';
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('.step-block, .scene-block');
        if (target && target !== dragEl && target.parentNode === container) {
            const rect = target.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            container.insertBefore(dragEl, next ? target.nextSibling : target);
        }
    });

     container.addEventListener('dragend', () => {
        if (dragEl) {
            dragEl.style.opacity = '1';
            dragEl = null;
            updateDatalists();
            // 🌟 追加：並べ替えが終わった瞬間に Undo 用の履歴を保存する
            if (typeof pushHistory === 'function') pushHistory();
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // --- 1. 元々の処理 (エディタの並べ替え初期化) ---
    makeSortable('scenario-container');
    makeSortable('edit-enemies');
    makeSortable('edit-items');
    makeSortable('edit-skills');
    makeSortable('edit-players');

    const newSceneInput = document.getElementById("new-scene-id");
    if (newSceneInput) newSceneInput.addEventListener("input", updateDatalists);

    updateDatalists();

    // --- 2. 追加の処理 (画像変換ツールのドロップ初期化) ---
    const dropzone = document.getElementById('aa-image-dropzone');
    const fileInput = document.getElementById('aa-image-input');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) generateAAFromImage(fileInput.files[0]);
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                generateAAFromImage(files[0]);
            }
        });
    }
});

window.toggleAATheater = function () {
    const container = document.getElementById('aa-iframe-container');
    const btn = document.getElementById('btn-theater');
    const isTheater = container.classList.contains('theater-active');

    if (!isTheater) {
        // シアターモード開始
        container.classList.add('theater-active');
        btn.classList.add('theater-btn-floating');
        btn.innerText = '閉じる (Esc)';
        document.body.style.overflow = 'hidden'; // 背後のスクロール禁止
    } else {
        // 通常モードに戻る
        container.classList.remove('theater-active');
        btn.classList.remove('theater-btn-floating');
        btn.innerText = '全画面表示';
        document.body.style.overflow = '';
    }
};

// ==========================================
// 画像 → AA 変換ツール機能
// ==========================================

// パネルの開閉
window.toggleAAGen = function (btn) {
    const body = document.getElementById('aa-gen-body');
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        btn.innerText = '閉じる';
    } else {
        body.style.display = 'none';
        btn.innerText = '開く';
    }
};

window.generateAAFromImage = function (droppedFile) {
    const fileInput = document.getElementById('aa-image-input');

    const widthInput = document.getElementById('aa-width-input');
    const paletteInput = document.getElementById('aa-palette-input');
    const output = document.getElementById('aa-gen-output');

    // ドロップされたファイルか、inputから選択されたファイルを取得
    const file = droppedFile instanceof File ? droppedFile : (fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null);

    if (!file) {
        alert("画像ファイルを選択またはドロップしてください！");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.getElementById('aa-canvas');
            if (!canvas) {
                alert("AA変換用のキャンバスが見つかりません。");
                return;
            }
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // 横幅の取得（要素がなければデフォルトの40を使う）
            const charWidth = (widthInput && parseInt(widthInput.value)) ? parseInt(widthInput.value) : 40;
            const fontAspectRatio = 0.55;
            const charHeight = Math.floor(charWidth * (img.height / img.width) * fontAspectRatio);

            canvas.width = charWidth;
            canvas.height = charHeight;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, charWidth, charHeight);

            const imgData = ctx.getImageData(0, 0, charWidth, charHeight);
            const data = imgData.data;

            // パレットの取得（要素がなければデフォルトのdetailedを使う）
            const paletteType = paletteInput ? paletteInput.value : "detailed";
            let density = "";
            switch (paletteType) {
                case "simple": density = "@%#*+=-:. "; break;
                case "ascii": density = "MWN$@%#&B89EGA6mK5HRkbYT43V0JL7gospq12ZCDXUkyPau*?|!(lIvw}{][:;\"^'`~_-,. "; break;
                case "block": density = "█▓▒░ "; break;
                case "binary": density = "# "; break;
                case "detailed":
                default: density = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. "; break;
            }

            let aaText = "";
            const contrast = 1.2;

            for (let y = 0; y < charHeight; y++) {
                for (let x = 0; x < charWidth; x++) {
                    const offset = (y * charWidth + x) * 4;
                    const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2]; const a = data[offset + 3];

                    if (a < 128) { aaText += " "; continue; }

                    let brightness = (0.299 * r + 0.587 * g + 0.114 * b);
                    brightness = ((brightness / 255 - 0.5) * contrast + 0.5) * 255;
                    brightness = Math.max(0, Math.min(255, brightness));

                    const charIndex = Math.floor((brightness / 256) * density.length);
                    aaText += density[charIndex];
                }
                aaText += "\n";
            }

            if (output) {
                output.value = aaText;
            } else {
                console.log(aaText); // 出力先がなければコンソールに出す
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};
// コピーボタンの処理
window.copyGenAA = function () {
    const output = document.getElementById('aa-gen-output');
    if (!output.value) {
        alert("先にAAを生成してください！");
        return;
    }
    output.select();
    document.execCommand('copy');
    alert("コピーしました！\nメッセージやキャラデータの設定欄に貼り付けて使ってください。");
};

// ==========================================
// デフォルト（既存）データの読み込み機能
// ==========================================
function applyAAToEditor(inp, val) {
    if (typeof val === "object" && val !== null) {
        let decodedObj = {};
        for (let face in val) decodedObj[face] = window.decodeAA(val[face]);
        inp.value = JSON.stringify(decodedObj);
    } else {
        inp.value = JSON.stringify({ "通常": window.decodeAA(val || "") });
    }
    const editor = inp.closest('.editor-group').querySelector('.multi-aa-editor');
    if (editor) {
        const textarea = editor.querySelector('.aa-input');
        let aaData = JSON.parse(inp.value);
        textarea.value = aaData["通常"] || "";
        updateAAPreview(textarea);
    }
}

window.loadDefaultPlayers = function () {
    if (!confirm("現在の【味方】エディタの内容をクリアして、チュートリアルデータを読み込みますか？")) return;
    document.getElementById("edit-players").innerHTML = "";
    const team = window.customPlayerTeam || INITIAL_PLAYER_TEAM; 
    team.forEach(pObj => {
        editorAddPlayer();
        const block = document.getElementById("edit-players").lastElementChild;
        const inputs = block.querySelectorAll(".player-data");
        inputs.forEach(inp => {
            const key = inp.getAttribute("data-key");
            let val = pObj[key];
            if (key === "skills" && Array.isArray(val)) inp.value = val.join(',');
            else if (key === "aa") applyAAToEditor(inp, val); // 🌟 修正
            else if (val !== undefined) inp.value = val;
        });
    });
};
window.loadDefaultEnemies = function () {
    if (!confirm("現在の【敵キャラ】エディタの内容をクリアして、チュートリアルデータを読み込みますか？")) return;
    document.getElementById("edit-enemies").innerHTML = "";
    if (!DEFAULT_ENEMY_MASTER) return; 
    Object.keys(DEFAULT_ENEMY_MASTER).forEach(eid => {
        editorAddEnemy();
        const block = document.getElementById("edit-enemies").lastElementChild;
        const inputs = block.querySelectorAll(".enemy-data");
        const eObj = DEFAULT_ENEMY_MASTER[eid]; 

        inputs.forEach(inp => {
            const key = inp.getAttribute("data-key");
            let val = eObj[key];
            if (key === "id") inp.value = eid;
            else if (key === "skills" && Array.isArray(val)) inp.value = val.join(',');
            else if (key === "aa") applyAAToEditor(inp, val);
            // 🌟 以下の新項目を復元対象に加える
            else if (key === "dropItem") inp.value = val || "";
            else if (key === "dropRate") inp.value = val || 0;
            else if (val !== undefined) inp.value = val;
        });
    });
};
window.loadDefaultItems = function () {
    if (!confirm("現在の【アイテム】エディタの内容をクリアして、チュートリアルデータを読み込みますか？")) return;
    document.getElementById("edit-items").innerHTML = "";
    if (!DEFAULT_ITEMS) return; 
    Object.keys(DEFAULT_ITEMS).forEach(iid => {
        editorAddItem();
        const block = document.getElementById("edit-items").lastElementChild;
        const inputs = block.querySelectorAll(".item-data");
        const iObj = DEFAULT_ITEMS[iid]; 
        inputs.forEach(inp => {
            const key = inp.getAttribute("data-key");
            let val = iObj[key];
            if (key === "id") inp.value = iid;
            else if (key === "aa") applyAAToEditor(inp, val);
            // 🌟 貴重品チェックボックスの復元
            else if (key === "isGlobal") inp.checked = !!val;
            else if (val !== undefined) inp.value = val;
        });
        // 🌟 アイテムの種類（秘伝書など）に応じて表示を切り替える処理を呼ぶ
        const typeSelect = block.querySelector('[data-key="type"]');
        if (typeSelect) window.toggleItemEditorUI(typeSelect);
    });
};

window.loadDefaultSkills = function () {
    if (!confirm("現在の【技】エディタの内容をクリアして、チュートリアルデータを読み込みますか？")) return;
    document.getElementById("edit-skills").innerHTML = "";
    if (!DEFAULT_SKILLS) return; 
    Object.keys(DEFAULT_SKILLS).forEach(sid => {
        editorAddSkill();
        const block = document.getElementById("edit-skills").lastElementChild;
        const inputs = block.querySelectorAll(".skill-data");
        const sObj = DEFAULT_SKILLS[sid]; 
        inputs.forEach(inp => {
            const key = inp.getAttribute("data-key");
            if (key === "id") inp.value = sid;
            else if (sObj[key] !== undefined) inp.value = sObj[key];
        });
    });
};

window.addSkillToInput = function (btn) {
    const container = btn.parentElement;
    const input = container.querySelector('.skill-input');
    const select = container.querySelector('.skill-helper-select');

    if (select.value) {
        if (input.value) {
            // 既に値がある場合はカンマで繋いで重複を防ぐ
            const arr = input.value.split(',').map(s => s.trim()).filter(s => s);
            if (!arr.includes(select.value)) {
                arr.push(select.value);
                input.value = arr.join(', ');
            }
        } else {
            input.value = select.value;
        }
    }
};

window.clearSkillInput = function (btn) {
    const container = btn.parentElement;
    const input = container.querySelector('.skill-input');
    input.value = "";
};

window.loadDefaultScenarios = function () {
    if (!confirm("現在のエディタのシナリオをクリアして、チュートリアル（初期データ）を読み込みますか？")) return;

    const container = document.getElementById("scenario-container");
    if (!container || !DEFAULT_SCENARIO) return; // 原本がなければ何もしない

    container.innerHTML = ""; // コンテナをクリア

    // 🌟 修正：作業用の SCENARIO ではなく、保護された DEFAULT_SCENARIO を読み込む！
    Object.keys(DEFAULT_SCENARIO).forEach(sceneId => {
        editorAddScene(sceneId);

        const steps = DEFAULT_SCENARIO[sceneId];
        steps.forEach(step => {
            editorAddStep(step.type, sceneId);
            const sceneBody = document.getElementById(`edit-steps-${sceneId}`);
            const block = sceneBody.lastElementChild;
            const inputs = block.querySelectorAll(".step-data");

            // 最適化：共通関数を呼び出すだけ！超スッキリ！
            fillStepInputs(step, inputs);
        });

        toggleScene(sceneId); // 最初は閉じておく
    });

    updateDatalists();
    alert("チュートリアル（初期データ）の読み込みが完了しました！");
};


// ==========================================
// 📂 ユニバーサル・ファイルドロップ（全画面対応）
// ==========================================

// ドロップ時のオーバーレイUIを動的生成
const dropOverlay = document.createElement('div');
dropOverlay.id = 'universal-drop-overlay';
dropOverlay.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(49,130,206,0.9); z-index:99999; color:#fff; font-size:24px; font-weight:bold; justify-content:center; align-items:center; flex-direction:column; border: 12px dashed #fff; box-sizing:border-box; pointer-events:none;';
dropOverlay.innerHTML = '<div style="font-size:40px; margin-bottom:20px;">📂</div><div>プロジェクトファイル(JSON)をドロップ</div><div style="font-size:16px; margin-top:15px; font-weight:normal;">タイトル画面なら即座にプレイ開始、エディタ画面なら編集データとして読み込みます</div>';
document.body.appendChild(dropOverlay);

let dragCounter = 0;

// 画面全体にドラッグイベントを設定
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.style.display = 'flex';
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) dropOverlay.style.display = 'none';
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});


// ----------------------------------------------------
// エディタへのデータ展開ロジック (DRY化・共通関数)
// ----------------------------------------------------
window.loadDataToEditorUI = function (data) {
    isBatchLoading = true;
    window.flowchartLayout = {};
    if (data.FLOWCHART_LAYOUT) {
        data.FLOWCHART_LAYOUT.split('|').forEach(part => {
            const [id, coords] = part.split(':');
            if (id && coords) {
                const [x, y] = coords.split(',').map(Number);
                window.flowchartLayout[id] = { x: x, y: y };
            }
        });
    }
    const titleInput = document.getElementById("project-title-input");
    if (titleInput) titleInput.value = data.PROJECT_TITLE || "";
    document.getElementById("scenario-container").innerHTML = "";
    document.getElementById("edit-enemies").innerHTML = "";
    document.getElementById("edit-items").innerHTML = "";
    document.getElementById("edit-players").innerHTML = "";
    document.getElementById("edit-skills").innerHTML = "";

    // 🌟 Playerの復元
    if (data.PLAYER_TEAM) {
        data.PLAYER_TEAM.forEach(pObj => {
            editorAddPlayer(); 
            const block = document.getElementById("edit-players").lastElementChild; 
            const inputs = block.querySelectorAll(".player-data");
            inputs.forEach(inp => {
                const key = inp.getAttribute("data-key"); 
                let val = pObj[key];
                
                if (key === "skills" && Array.isArray(val)) {
                    inp.value = val.join(',');
                } else if (key === "aa") {
                    if (typeof val === "object" && val !== null) {
                        let decodedObj = {};
                        for (let face in val) decodedObj[face] = window.decodeAA(val[face]);
                        inp.value = JSON.stringify(decodedObj);
                    } else {
                        inp.value = JSON.stringify({ "通常": window.decodeAA(val || "") });
                    }
                    const editor = inp.closest('.editor-group').querySelector('.multi-aa-editor');
                    if (editor) {
                        const textarea = editor.querySelector('.aa-input');
                        let aaData = JSON.parse(inp.value);
                        textarea.value = aaData["通常"] || "";
                        updateAAPreview(textarea);
                    }
                } else if (val !== undefined) {
                    inp.value = val;
                }
            });
        });
    }

    // 🌟 Scenarioの復元
    if (data.SCENARIO) {
        Object.keys(data.SCENARIO).forEach(sceneId => {
            editorAddScene(sceneId);
            data.SCENARIO[sceneId].forEach(step => {
                editorAddStep(step.type, sceneId);
                const container = document.getElementById(`edit-steps-${sceneId}`);
                const block = container.lastElementChild; 
                const inputs = block.querySelectorAll(".step-data");
                fillStepInputs(step, inputs);
            });
            toggleScene(sceneId);
        });
    }

    // 🌟 Enemyの復元（エラー原因だった箇所）
    if (data.ENEMY_MASTER) {
        Object.keys(data.ENEMY_MASTER).forEach(eid => {
            editorAddEnemy(); 
            const block = document.getElementById("edit-enemies").lastElementChild; 
            const inputs = block.querySelectorAll(".enemy-data"); 
            const eObj = data.ENEMY_MASTER[eid];
            
            inputs.forEach(inp => { 
                const key = inp.getAttribute("data-key"); 
                let val = eObj[key]; // 👈 変数valの定義を追加！
                
                if (key === "id") {
                    inp.value = eid; 
                } else if (key === "skills" && Array.isArray(val)) {
                    inp.value = val.join(','); 
                } else if (key === "aa") {
                    if (typeof val === "object" && val !== null) {
                        let decodedObj = {};
                        for (let face in val) decodedObj[face] = window.decodeAA(val[face]);
                        inp.value = JSON.stringify(decodedObj);
                    } else {
                        inp.value = JSON.stringify({ "通常": window.decodeAA(val || "") });
                    }
                    const editor = inp.closest('.editor-group').querySelector('.multi-aa-editor');
                    if (editor) {
                        const textarea = editor.querySelector('.aa-input');
                        let aaData = JSON.parse(inp.value);
                        textarea.value = aaData["通常"] || "";
                        updateAAPreview(textarea);
                    }
                } else if (val !== undefined) {
                    inp.value = val;
                }
            });
        });
    }

    // 🌟 Itemの復元
    if (data.ITEMS) {
        Object.keys(data.ITEMS).forEach(iid => {
            editorAddItem(); 
            const block = document.getElementById("edit-items").lastElementChild; 
            const inputs = block.querySelectorAll(".item-data"); 
            const iObj = data.ITEMS[iid];
            
            inputs.forEach(inp => { 
                const key = inp.getAttribute("data-key"); 
                let val = iObj[key]; // 👈 変数valの定義を追加！
                
                if (key === "id") {
                    inp.value = iid; 
                } else if (key === "aa") {
                    if (typeof val === "object" && val !== null) {
                        let decodedObj = {};
                        for (let face in val) decodedObj[face] = window.decodeAA(val[face]);
                        inp.value = JSON.stringify(decodedObj);
                    } else {
                        inp.value = JSON.stringify({ "通常": window.decodeAA(val || "") });
                    }
                    const editor = inp.closest('.editor-group').querySelector('.multi-aa-editor');
                    if (editor) {
                        const textarea = editor.querySelector('.aa-input');
                        let aaData = JSON.parse(inp.value);
                        textarea.value = aaData["通常"] || "";
                        updateAAPreview(textarea);
                    }
                } else if (val !== undefined) {
                    inp.value = val;
                }
            });
        });
    }

    // 🌟 Skillの復元
    if (data.SKILLS) {
        Object.keys(data.SKILLS).forEach(sid => {
            editorAddSkill(); 
            const block = document.getElementById("edit-skills").lastElementChild; 
            const inputs = block.querySelectorAll(".skill-data"); 
            const sObj = data.SKILLS[sid];
            
            inputs.forEach(inp => { 
                const key = inp.getAttribute("data-key"); 
                if (key === "id") inp.value = sid; 
                else if (sObj[key] !== undefined) inp.value = sObj[key]; 
            });
        });
    }

    isBatchLoading = false;
    updateDatalists();

    makeSortable('scenario-container');
    makeSortable('edit-enemies');
    makeSortable('edit-items');
    makeSortable('edit-skills');
    makeSortable('edit-players');
    
    document.querySelectorAll('.scene-block').forEach(block => {
        const sid = block.getAttribute('data-scene-id');
        if (sid) makeSortable(`edit-steps-${sid}`);
    });
};

window.editorDuplicateStep = function (stepId) {
    const original = document.getElementById(stepId);
    if (!original) return;
    const sceneId = original.closest('.scene-block').getAttribute('data-scene-id');
    const type = original.querySelector('.step-type').value;

    editorAddStep(type, sceneId); // 新規追加
    const newBlock = document.getElementById(`edit-steps-${sceneId}`).lastElementChild;

    // 値をコピー
    const origInputs = original.querySelectorAll('.step-data');
    const newInputs = newBlock.querySelectorAll('.step-data');
    origInputs.forEach((inp, i) => {
            if (newInputs[i]) {
                if (inp.type === "checkbox") {
                    newInputs[i].checked = inp.checked;
                } else {
                    newInputs[i].value = inp.value;
                }
                if (inp.classList.contains('aa-input')) updateAAPreview(newInputs[i]);
            }
        });

    // 元の要素のすぐ下に移動
    original.parentNode.insertBefore(newBlock, original.nextSibling);
    updateDatalists();
};

// シーン全体の複製
window.editorDuplicateScene = function (sid) {
    const newSid = sid + "_copy_" + Date.now().toString().slice(-4);
    editorAddScene(newSid); // 新しいシーン枠を作成

    const origContainer = document.getElementById(`edit-steps-${sid}`);
    const stepBlocks = origContainer.querySelectorAll('.step-block');

    stepBlocks.forEach(block => {
        const type = block.querySelector('.step-type').value;
        editorAddStep(type, newSid);

        const newBlock = document.getElementById(`edit-steps-${newSid}`).lastElementChild;
        const origInputs = block.querySelectorAll('.step-data');
        const newInputs = newBlock.querySelectorAll('.step-data');
        origInputs.forEach((inp, i) => {
            if (newInputs[i]) {
                if (inp.type === "checkbox") {
                    newInputs[i].checked = inp.checked;
                } else {
                    newInputs[i].value = inp.value;
                }
                if (inp.classList.contains('aa-input')) updateAAPreview(newInputs[i]);
            }
        });
    });
    updateDatalists();
};

window.toggleBlocks = function (targetSelector, collapseClass, forceState = null) {
    document.querySelectorAll(targetSelector).forEach(el => {
        if (forceState === true) {
            el.classList.remove(collapseClass); // 強制的に開く
        } else if (forceState === false) {
            el.classList.add(collapseClass);    // 強制的に閉じる
        } else {
            el.classList.toggle(collapseClass); // 今と逆にする（反転）
        }
    });
};

// --- 以下、汎用関数を利用した個別呼び出し（HTMLを変えなくて済むようにラップする） ---

// ① 個別のステップ（セリフなど）を開閉
window.toggleStep = function (id) {
    toggleBlocks(`#${id}`, 'step-collapsed');
};

// ② 個別のシーン枠を開閉
window.toggleScene = function (sid) {
    toggleBlocks(`#scene-block-${sid}`, 'scene-collapsed');
};

// ③ 全てのシーンを一括で開閉（true:開く, false:閉じる）
window.toggleAllScenes = function (expand) {
    // 🌟 修正：シナリオタブにいる時だけシーン枠を開閉する
    if (document.getElementById("tab-scenario").classList.contains("active")) {
        toggleBlocks('.scene-block', 'scene-collapsed', expand);
    }
};

// ★ おまけ：全てのステップ（セリフなど）を一括で開閉する新機能！
window.toggleAllSteps = function (expand) {
    // 🌟 修正：現在表示されているアクティブなタブの中にある step-block だけを開閉する！
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        const blocks = activeTab.querySelectorAll('.step-block');
        blocks.forEach(el => {
            if (expand === true) el.classList.remove('step-collapsed');
            else if (expand === false) el.classList.add('step-collapsed');
            else el.classList.toggle('step-collapsed');
        });
    }
};

// ==========================================
// プロジェクト内AAピッカー 機能 (5カテゴリ完全対応)
// ==========================================

window.initInternalAAPickers = function () {
    if (typeof AA_MAP === 'undefined') return;

    // 各カテゴリの初期化HTML
    const htmls = {
        CHARACTER: `<option value="">👤 キャラクターを選ぶ...</option>`,
        LAYOUT: `<option value="">🖼️ レイアウトを選ぶ...</option>`,
        ITEM: `<option value="">🗡️ アイテムを選ぶ...</option>`,
        STAGE: `<option value="">⛰️ ステージを選ぶ...</option>`,
        EFFECT: `<option value="">💥 エフェクトを選ぶ...</option>`
    };

    // AA_MAPを走査して各カテゴリに振り分け
    for (let key in AA_MAP) {
        const category = key.split('.')[0]; // "CHARACTER" など
        if (htmls[category] !== undefined) {
            const displayName = AA_MAP[key].name || key;
            htmls[category] += `<option value="${key}">${displayName}</option>`;
        }
    }

    // セレクトボックスに流し込む
    document.getElementById("aa-sel-character").innerHTML = htmls.CHARACTER;
    document.getElementById("aa-sel-layout").innerHTML = htmls.LAYOUT;
    document.getElementById("aa-sel-item").innerHTML = htmls.ITEM;
    document.getElementById("aa-sel-stage").innerHTML = htmls.STAGE;
    document.getElementById("aa-sel-effect").innerHTML = htmls.EFFECT;
};

// 選んだパックを動的ロードし、中身のキーをボタン化する
window.loadInternalAAPack = async function (packKey, selectedCategory) {
    // 他のカテゴリのセレクトボックスをリセットして見やすくする
    document.querySelectorAll(".aa-pack-select").forEach(sel => {
        if (!sel.id.includes(selectedCategory.toLowerCase())) {
            sel.value = "";
        }
    });

    const listDiv = document.getElementById("internal-aa-list");
    if (!packKey) {
        listDiv.innerHTML = `<span style="font-size:11px; color:#718096;">上のリストからパックを選ぶと、ここにAA一覧が出ます</span>`;
        return;
    }

    listDiv.innerHTML = `<span style="font-size:11px; color:#3182ce; font-weight:bold;">通信中... (ロード待機)</span>`;

    try {
        // 🌟 修正ポイント：AA_MAPからパスを引くのではなく、キーから直接パスを計算する！
        const packKeyLower = packKey.toLowerCase();
        const parts = packKeyLower.split('.');

        const filePath = `${parts[0]}/${parts[1]}/${parts[2]}.mlt`;

        if (!AA_CACHE[packKey]) {
            // 🌟変更：Fetch でテキストとして読み込み、タグを解析する
            const response = await fetch(`./aa_library/${filePath}`);
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

            AA_CACHE[packKey] = parsedData;
        }

        const data = AA_CACHE[packKey];
        if (!data) throw new Error("Data not found");

        let html = "";
        for (let aaId in data) {
            // ボタンを押したときに呼び出すフルパスを生成（例: CHARACTER.ORIGINAL.YARUO.normal）
            const fullPath = `${packKey}.${aaId}`;
            html += `<button class="cmd-btn" style="background:#e2e8f0; color:#2d3748; border:1px solid #cbd5e0; box-shadow:none !important;" onclick="previewInternalAA('${fullPath}')">${aaId}</button>`;
        }
        listDiv.innerHTML = html;

    } catch (e) {
        console.error("ピッカー用ロード失敗:", e);
        listDiv.innerHTML = `<span style="font-size:11px; color:#e53e3e;">読み込み失敗: ファイルが見つかりません</span>`;
    }
};

window.previewInternalAA = async function (fullPath) {
    document.getElementById("internal-aa-path").value = fullPath;
    const pre = document.getElementById("internal-aa-preview");
    pre.innerText = "ロード中...";
    pre.style.color = "#fff";

    try {
        const aaStr = await resolveAA(fullPath);

        // resolveAA が文字列をそのまま返してきた＝何らかのエラーで見つからなかった
        if (aaStr === fullPath) {
            // 開発者ツール（F12）のコンソールに原因が出ているはずなので、それを促す
            pre.innerText = `【エラー】AAデータが見つかりません。\nパス: ${fullPath}\n\n※F12キーを押して「Console」タブを開くと、\n詳しいエラー原因（404など）が表示されています。`;
            pre.style.color = "#fc8181"; // 赤色
        } else {
            pre.innerText = aaStr;
        }
    } catch (e) {
        console.error("プレビュー失敗:", e);
        pre.innerText = "【システムエラー】読み込みに失敗しました。";
        pre.style.color = "#fc8181";
    }
};

window.copyInternalAA = function () {
    const input = document.getElementById("internal-aa-path");
    if (!input.value) { alert("先にAAを選択してください！"); return; }
    input.select(); document.execCommand("copy");
    alert(`「${input.value}」\nをコピーしました！`);
};
window.copyInternalAAContent = function () {
    const pre = document.getElementById("internal-aa-preview");
    if (!pre.innerText || pre.innerText.includes("ロード中") || pre.innerText.includes("エラー")) {
        alert("コピーするAAが表示されていません！"); return;
    }
    // テキストエリアを作って中身をコピーさせる（改行を保持するため）
    const temp = document.createElement("textarea");
    temp.value = pre.innerText;
    document.body.appendChild(temp);
    temp.select(); document.execCommand("copy");
    document.body.removeChild(temp);
    alert("AAの中身をコピーしました！\n直書きしたい場所に貼り付けてください。");
};

// エディタが開かれた時（または初期化時）にピッカーのリストを構築する
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initInternalAAPickers, 500); // 念のため少し遅延させて確実に入れる
});

// ==========================================
// 冒険の書（画像カード）エクスポート・インポート機能
// 【解像度1000x1000 / 2x2ピクセル高密度・自動補正・可変デッキモデル】
// ==========================================

const CHUNK_LIMIT = 115 * 1024;
const CANVAS_SIZE = 1000;
const BLOCK_SIZE = 2;

// 1. 文字列をDeflate圧縮して生バイナリ(Uint8Array)を返す
async function compressToBinary(str) {
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('deflate'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
}

// 2. 生バイナリ(Uint8Array)をDeflate解凍して文字列を返す
async function decompressFromBinary(uint8Array) {
    const stream = new Blob([uint8Array]).stream().pipeThrough(new DecompressionStream('deflate'));
    const response = new Response(stream);
    return await response.text();
}


// 3. メタデータと圧縮バイナリをPNGの末尾に結合する関数
function appendMultiDataToPNG(pngBuffer, metaObj, compressedData) {
    const pngArray = new Uint8Array(pngBuffer);
    const metaBytes = new TextEncoder().encode(JSON.stringify(metaObj));
    const magic = new TextEncoder().encode("ANKO"); // 目印

    const metaSize = metaBytes.length;
    const dataSize = compressedData.length;

    const outBuffer = new Uint8Array(pngArray.length + metaSize + dataSize + 12);
    let offset = 0;
    outBuffer.set(pngArray, offset); offset += pngArray.length;
    outBuffer.set(metaBytes, offset); offset += metaSize;
    outBuffer.set(compressedData, offset); offset += dataSize;

    const dv = new DataView(outBuffer.buffer);
    dv.setUint32(offset, metaSize, true); offset += 4;
    dv.setUint32(offset, dataSize, true); offset += 4;

    outBuffer.set(magic, offset);
    return outBuffer;
}
function extractMultiDataFromPNG(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    if (data.length < 12) return null;

    const magicStr = String.fromCharCode(data[data.length - 4], data[data.length - 3], data[data.length - 2], data[data.length - 1]);
    if (magicStr !== "ANKO") return null;

    const dv = new DataView(arrayBuffer);
    const dataSize = dv.getUint32(data.length - 8, true);
    const metaSize = dv.getUint32(data.length - 12, true);

    if (data.length < metaSize + dataSize + 12) return null;

    const dataStart = data.length - 12 - dataSize;
    const metaStart = dataStart - metaSize;

    const metaBytes = data.slice(metaStart, dataStart);
    const compressedData = data.slice(dataStart, dataStart + dataSize);

    try {
        const metaObj = JSON.parse(new TextDecoder().decode(metaBytes));
        return { meta: metaObj, data: compressedData };
    } catch (e) {
        return null;
    }
}
function* getBlockCoords(width, height, blockSize) {
    for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
            if (y === 0 && x < 16 * blockSize) continue; 
            if (x >= 300 && x < 700 && y >= 450 && y < 550) continue;
            yield {x, y};
        }
    }
}

const PALETTE_HEX =["#000000", "#FFFFFF", "#e53e3e", "#38a169", "#3182ce", "#d69e2e", "#00B5D8", "#9F7AEA", "#A0AEC0", "#9B2C2C", "#276749", "#2A4365", "#975A16", "#234E52", "#553C9A", "#718096"];

// ==========================================
// ピクセル・インポーター (JPEG圧縮・SNS耐性デコーダー)
// ==========================================
const PALETTE_RGB = [[0, 0, 0], [255, 255, 255], [229, 62, 62], [56, 161, 105], [49, 130, 206], [214, 158, 46], [0, 181, 216], [159, 122, 234], [160, 174, 192], [155, 44, 44], [39, 103, 73], [42, 67, 101], [151, 90, 22], [35, 78, 82], [85, 60, 154], [113, 128, 150]
];

// 最も近い色をエウクリード距離で判定し、にじみを補正する
function getClosestColorIndex(r, g, b) {
    let minDiff = Infinity; let bestIdx = 0;
    for (let i = 0; i < PALETTE_RGB.length; i++) {
        const diff = (r - PALETTE_RGB[i][0]) ** 2 + (g - PALETTE_RGB[i][1]) ** 2 + (b - PALETTE_RGB[i][2]) ** 2;
        if (diff < minDiff) { minDiff = diff; bestIdx = i; }
    }
    return bestIdx;
}

// 画像のピクセルをスキャンしてデータを復元
function extractDataFromPixels(imgElement) {
    const canvas = document.createElement("canvas");
    canvas.width = imgElement.width; canvas.height = imgElement.height;
    
    if (canvas.width !== CANVAS_SIZE || canvas.height !== CANVAS_SIZE) {
        console.warn("画像サイズがリサイズされているため、画素からの復元はできません。");
        return null;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(imgElement, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // 1. 基準色キャリブレーション (左上の16ブロックから実際のRGBを抽出)
    let dynamicPalette =[];
    for (let i = 0; i < 16; i++) {
        let rSum=0, gSum=0, bSum=0, count=0;
        for(let dy=0; dy<BLOCK_SIZE; dy++){
            for(let dx=0; dx<BLOCK_SIZE; dx++){
                const idx = ((0 + dy) * canvas.width + (i * BLOCK_SIZE + dx)) * 4;
                rSum += imgData[idx]; gSum += imgData[idx+1]; bSum += imgData[idx+2];
                count++;
            }
        }
        dynamicPalette.push([rSum/count, gSum/count, bSum/count]); // なまった色を基準とする
    }

    const getDynamicColorIndex = (r, g, b) => {
        let minDiff = Infinity; let bestIdx = 0;
        for (let i = 0; i < 16; i++) {
            const diff = (r - dynamicPalette[i][0]) ** 2 + (g - dynamicPalette[i][1]) ** 2 + (b - dynamicPalette[i][2]) ** 2;
            if (diff < minDiff) { minDiff = diff; bestIdx = i; }
        }
        return bestIdx;
    };

    const totalBlocks = (CANVAS_SIZE / BLOCK_SIZE) * (CANVAS_SIZE / BLOCK_SIZE);
    const skipBlocks = (400 / BLOCK_SIZE) * (100 / BLOCK_SIZE);
    const maxBytes = Math.floor((totalBlocks - 16 - skipBlocks) / 2);
    
    const extracted = new Uint8Array(maxBytes);
    let byteIdx = 0; let highNibble = true; let currentByte = 0;
    let expectedTotalLen = Infinity;

    const coords = getBlockCoords(CANVAS_SIZE, CANVAS_SIZE, BLOCK_SIZE);
    let coordRes = coords.next();

    while(!coordRes.done) {
        let cx = coordRes.value.x;
        let cy = coordRes.value.y;

        // --- 多数決スキャンロジックはそのまま ---
        let votes = new Array(16).fill(0);
        for(let dy=0; dy<BLOCK_SIZE; dy++){
            for(let dx=0; dx<BLOCK_SIZE; dx++){
                const idx = ((cy + dy) * CANVAS_SIZE + (cx + dx)) * 4;
                const cIdx = getDynamicColorIndex(imgData[idx], imgData[idx+1], imgData[idx+2]);
                votes[cIdx]++;
            }
        }
        let colorIdx = 0, maxVote = -1;
        for(let i=0; i<16; i++) { if(votes[i] > maxVote) { maxVote = votes[i]; colorIdx = i; } }

        if (highNibble) {
            currentByte = (colorIdx << 4);
            highNibble = false;
        } else {
            currentByte |= colorIdx;
            extracted[byteIdx++] = currentByte;
            highNibble = true;

            if (byteIdx === 2) {
                const dv = new DataView(extracted.buffer);
                const metaLen = dv.getUint16(0, false);
                if (metaLen > maxBytes) return null;
            }
            const dv = new DataView(extracted.buffer);
            const metaLen = byteIdx >= 2 ? dv.getUint16(0, false) : 0;
            if (byteIdx === 2 + metaLen + 4) {
                const dataLen = dv.getUint32(2 + metaLen, false);
                expectedTotalLen = 2 + metaLen + 4 + dataLen;
            }
            if (byteIdx >= expectedTotalLen) {
                const metaBytes = extracted.slice(2, 2 + metaLen);
                const meta = JSON.parse(new TextDecoder().decode(metaBytes));
                const data = extracted.slice(2 + metaLen + 4, expectedTotalLen);
                return { meta, data };
            }
        }
        coordRes = coords.next();
    }
    return null;
}
window.exportProjectToImage = async function () {
    const dataObj = getEditorJSONData();
    if (!dataObj.json.SCENARIO || Object.keys(dataObj.json.SCENARIO).length === 0) {
        alert("書き出すデータがありません！"); return;
    }

    const titleInput = document.getElementById("project-title-input");
    const defaultTitle = (titleInput && titleInput.value) ? titleInput.value : "anko_quest";
    let safeTitle = prompt("保存するデータ（デッキ）の名前を入力してください", defaultTitle);
    if (safeTitle === null) return;

    // 🌟 修正：長すぎる名前によるレイアウト破壊・エラーを防ぐため30文字でカット
    safeTitle = safeTitle.trim().replace(/[\\/:*?"<>|]/g, "_").substring(0, 30) || "anko_quest";

    const packedScenario = packScenario(dataObj.json.SCENARIO);
    const projectHash = await calculateGameHash();

     const fullProjectData = {
        PLAYER_TEAM: dataObj.json.PLAYER_TEAM ||[],
        ENEMY_MASTER: dataObj.json.ENEMY_MASTER || {},
        ITEMS: dataObj.json.ITEMS || {},
        SKILLS: dataObj.json.SKILLS || {},
        SCENARIO: packedScenario || {}
    };

    const compressedBinary = await compressToBinary(JSON.stringify(fullProjectData));
    const totalChunks = Math.ceil(compressedBinary.length / CHUNK_LIMIT);

    let exportQueue =[];
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_LIMIT;
        const end = Math.min(start + CHUNK_LIMIT, compressedBinary.length);
        exportQueue.push({
            meta: { pid: safeTitle, hash: projectHash, chunkIdx: i, totalChunks: totalChunks, type: "PROJECT_DECK" },
            data: compressedBinary.slice(start, end)
        });
    }

    alert(`データのエクスポートを開始します。\n全 ${exportQueue.length} 枚の「データ専用画像」がダウンロードされます。`);

    const PALETTE_HEX =["#000000", "#FFFFFF", "#e53e3e", "#38a169", "#3182ce", "#d69e2e", "#00B5D8", "#9F7AEA", "#A0AEC0", "#9B2C2C", "#276749", "#2A4365", "#975A16", "#234E52", "#553C9A", "#718096"];

    for (let i = 0; i < exportQueue.length; i++) {
        const item = exportQueue[i];
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_SIZE; canvas.height = CANVAS_SIZE; 
        const ctx = canvas.getContext("2d");

        let byteIdx = 0; let highNibble = true;

        const metaStr = JSON.stringify(item.meta);
        const metaBytes = new TextEncoder().encode(metaStr);
        const dataLength = item.data.length;

        const totalLen = 2 + metaBytes.length + 4 + dataLength;
        const pixelData = new Uint8Array(totalLen);
        const dv = new DataView(pixelData.buffer);

        dv.setUint16(0, metaBytes.length, false);
        pixelData.set(metaBytes, 2);
        dv.setUint32(2 + metaBytes.length, dataLength, false);
        pixelData.set(item.data, 2 + metaBytes.length + 4);

        // 1. キャリブレーション領域の描画
        for (let j = 0; j < 16; j++) {
            ctx.fillStyle = PALETTE_HEX[j];
            ctx.fillRect(j * BLOCK_SIZE, 0, BLOCK_SIZE, BLOCK_SIZE);
        }

        // 2. データ領域の描画
        const coords = getBlockCoords(canvas.width, canvas.height, BLOCK_SIZE);
        let coordRes = coords.next();

        while(!coordRes.done) {
            let cx = coordRes.value.x, cy = coordRes.value.y;
            let colorIdx = 0;
            if (byteIdx < pixelData.length) { 
                const byte = pixelData[byteIdx];
                if (highNibble) {
                    colorIdx = (byte >> 4) & 0x0F;
                    highNibble = false;
                } else {
                    colorIdx = byte & 0x0F;
                    highNibble = true;
                    byteIdx++;
                }
            } else {
                colorIdx = Math.floor(Math.random() * 16);
            }
            ctx.fillStyle = PALETTE_HEX[colorIdx];
            ctx.fillRect(cx, cy, BLOCK_SIZE, BLOCK_SIZE);
            coordRes = coords.next();
        }

        // 3. サムネイル描画
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.fillRect(300, 450, 400, 100);
        ctx.strokeStyle = "#ecc94b"; ctx.lineWidth = 4;
        ctx.strokeRect(300, 450, 400, 100);
        
        // 🌟 追加：クリッピングマスク（この枠の外には文字を描画させない強力なブロック）
        ctx.save();
        ctx.beginPath();
        ctx.rect(300, 450, 400, 100);
        ctx.clip(); // マスク適用！

        ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
        // 🌟 修正：maxWidth (380) を指定し、枠より長い場合は自動で細長く圧縮させる
        ctx.fillText(safeTitle, 500, 490, 380);
        
        ctx.fillStyle = "#ecc94b"; ctx.font = "18px sans-serif";
        ctx.fillText(`DATA CARD: ${item.meta.chunkIdx + 1} / ${item.meta.totalChunks}`, 500, 525);

        ctx.restore(); // クリッピング解除（ここまで）

        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        const arrayBuffer = await blob.arrayBuffer();
        const finalPngBuffer = appendMultiDataToPNG(arrayBuffer, item.meta, item.data);

        const finalBlob = new Blob([finalPngBuffer], { type: "image/png" });
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeTitle}_${item.meta.chunkIdx + 1}of${item.meta.totalChunks}.png`;
        a.click();
        URL.revokeObjectURL(url);

        await new Promise(r => setTimeout(r, 400));
    }
    alert("全てのエクスポートが完了しました！");
};

// ==========================================
// 🌟 ダッシュボード UI 管理
// ==========================================
function createOrUpdateDashboard(meta) {
    let dash = document.getElementById("import-dashboard");
    if (!dash) {
        dash = document.createElement("div");
        dash.id = "import-dashboard";
        document.body.appendChild(dash);
    }
    dash.style.display = "flex";

    let loaded = window.importBuffer.chunks.filter(c => c !== null).length;
    let isDone = loaded === window.importBuffer.totalFiles;

    let html = `<h2>📂 読み込み中...[ ${meta.pid} ]</h2><div class="dashboard-grid">`;
    html += `
        <div class="dash-card ${isDone ? 'done' : ''}" style="grid-column: 1 / -1;">
            <div class="dash-title">プロジェクトデータ</div>
            <div class="dash-progress">${loaded} / ${window.importBuffer.totalFiles}</div>
        </div>`;
    html += `</div><div class="dash-footer">不足している画像をドロップしてください</div>`;
    dash.innerHTML = html;

    return isDone;
}

window.importBuffer = null;

// ----------------------------------------------------
// 複数カードの同時読み込み＆自動結合ロジック
// ----------------------------------------------------
async function processImportFile(file) {
    const isPng = file.name.toLowerCase().endsWith('.png') || file.type === "image/png";
    if (!isPng) {
        const jsonStr = await file.text();
        const data = JSON.parse(jsonStr);
        if (data.SCENARIO) data.SCENARIO = unpackScenario(data.SCENARIO);
        return data;
    }

    const arrayBuffer = await file.arrayBuffer();
    let extracted = extractMultiDataFromPNG(arrayBuffer);

    if (!extracted) {
        console.warn(`EOFバイナリがありません。ピクセルからの復元を試みます...`);
        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = URL.createObjectURL(file);
            });
            extracted = extractDataFromPixels(img); 
        } catch (e) { console.error("ピクセル解析失敗:", e); }
    }
    if (!extracted) return null;

    const { meta, data } = extracted;
    if (meta.type === "SAVE_DATA") {
        const jsonStr = await decompressFromBinary(data);
        return JSON.parse(jsonStr);
    }

    if (window.importBuffer && window.importBuffer.pid !== meta.pid) {
        alert(`⚠️ エラー！\n現在読み込んでいるプロジェクト[${window.importBuffer.pid}] と異なるカードが混ざりました。バッファをリセットします。`);
        window.importBuffer = null;
    }

    if (!window.importBuffer) {
        // 🌟 修正：カテゴリ(catId) を廃止し、全体の配列で管理する
        window.importBuffer = { pid: meta.pid, hash: meta.hash, totalFiles: meta.totalChunks, chunks: new Array(meta.totalChunks).fill(null) };
    }

    if (window.importBuffer.chunks[meta.chunkIdx] === null) {
        window.importBuffer.chunks[meta.chunkIdx] = data;
    }

    const isComplete = createOrUpdateDashboard(meta);

    if (isComplete) {
        console.log("すべてのカードが揃いました。結合を開始します。");
        const totalLen = window.importBuffer.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedBinary = new Uint8Array(totalLen);
        
        let offset = 0;
        for (let chunk of window.importBuffer.chunks) {
            combinedBinary.set(chunk, offset); 
            offset += chunk.length;
        }
        
        const jsonStr = await decompressFromBinary(combinedBinary);
        const finalData = JSON.parse(jsonStr);

        setTimeout(() => {
            const dash = document.getElementById("import-dashboard");
            if(dash) dash.style.display = "none";
        }, 1000);

        window.importBuffer = null;
        if (finalData.SCENARIO) finalData.SCENARIO = unpackScenario(finalData.SCENARIO);
        return finalData; 
    }

    return "WAITING";
}


document.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (typeof dragCounter !== 'undefined') dragCounter = 0;
    const dropOverlay = document.getElementById('universal-drop-overlay');
    if (dropOverlay) dropOverlay.style.display = 'none';

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    try {
        let finalData = null;
        for (let i = 0; i < files.length; i++) {
            const result = await processImportFile(files[i]);
            if (result && result !== "WAITING") finalData = result;
        }

        if (finalData) {
            const isEditorActive = document.getElementById("view-editor").classList.contains("active");
            if (isEditorActive) {
                loadDataToEditorUI(finalData);
                alert("📂 エディタにデータを読み込みました！");
} else {
                // 🌟 修正：ファイルを読み込む際も、デフォルトデータを残しつつ上書きする
                if (finalData.SCENARIO) Object.assign(SCENARIO, finalData.SCENARIO);
                if (finalData.ENEMY_MASTER) Object.assign(ENEMY_MASTER, finalData.ENEMY_MASTER);
                if (finalData.ITEMS) Object.assign(ITEMS, finalData.ITEMS);
                if (finalData.SKILLS) Object.assign(SKILLS, finalData.SKILLS);
                if (finalData.PLAYER_TEAM && finalData.PLAYER_TEAM.length > 0) window.customPlayerTeam = finalData.PLAYER_TEAM;

                alert("🎮 全ての冒険の書を読み込みました！ゲームを開始します。");
                if (typeof closeImportModal === 'function') closeImportModal();
                startGame();
            }
        }
    } catch (err) {
        console.error(err); alert("❌ 無効なファイルが含まれています。");
    }
});
// 6. 画像やJSONファイルを読み込んで復元する処理
window.importProjectFromFile = async function (event) {
    const files = event.target.files;
    if (files.length === 0) return;

    try {
        let finalData = null;
        for (let i = 0; i < files.length; i++) {
            const result = await processImportFile(files[i]);
            if (result && result !== "WAITING") finalData = result;
        }

        if (finalData) {
            finalData = hydrateData(finalData);

            const isEditorActive = document.getElementById("view-editor") && document.getElementById("view-editor").classList.contains("active");
            if (isEditorActive) {
                loadDataToEditorUI(finalData);
                alert("🎉 デッキ（画像群）からデータの復元に成功しました！");
            } else {
                if (finalData.SCENARIO) Object.assign(SCENARIO, finalData.SCENARIO);
                if (finalData.ENEMY_MASTER) Object.assign(ENEMY_MASTER, finalData.ENEMY_MASTER);
                if (finalData.ITEMS) Object.assign(ITEMS, finalData.ITEMS);
                if (finalData.SKILLS) Object.assign(SKILLS, finalData.SKILLS);
                if (finalData.PLAYER_TEAM && finalData.PLAYER_TEAM.length > 0) window.customPlayerTeam = finalData.PLAYER_TEAM;

                alert("🎮 全ての冒険の書を読み込みました！ゲームを開始します。");
                if (typeof closeImportModal === 'function') closeImportModal();
                startGame();
            }
        } else {
            const remain = window.importBuffer ? (window.importBuffer.totalFiles - window.importBuffer.loadedCount) : 0;
            alert(`読み込み中...\nあと ${remain} 枚のカードが必要です。続けて読み込んでください。`);
        }
    } catch (err) {
        console.error(err); alert("❌ データの読み込みに失敗しました。");
    }
    event.target.value = "";
};

// ==========================================
// 🌟 改良版：シナリオデータ・安全圧縮パッカー
// ==========================================

// ステップのタイプを短い文字に変換する辞書
const TYPE_SHORT = {
    "system_set": "sy", "msg": "ms", "choice": "ch", "battle": "bt",
    "jump": "jp", "shop": "sp", "give": "gv", "flag_set": "fs", "flag_check": "fc",
    "recover": "rc", "dice_choice": "dc", "stat_roll": "sr", "end": "ed", "map": "mp",
    "party_edit": "pe", "fusion": "fu", "stat_change": "sc", "minigame": "mg",
    "pass_time": "pt", "craft": "cr", "bg_set": "bg", "job_change": "jc", "join_party": "jp_p"
};
const TYPE_LONG = Object.fromEntries(Object.entries(TYPE_SHORT).map(([k, v]) => [v, k]));

// 長いプロパティ名を1〜2文字に変換する圧縮辞書
const KEY_DICT = {
    "type": "t", "enableLevelUp": "el", "enableResistance": "er", "enableAttribute": "ea",
    "enablePartyBattle": "ep", "enableTactical": "et", "speaker": "sp", "text": "tx",
    "choices": "ch", "enemies": "en", "initiative": "in", "mapData": "md",
    "next": "nx", "targetId": "ti", "flagName": "fn", "operator": "op", "flagValue": "fv",
    "gameType": "gt", "difficulty": "df", "rewards": "rw", 
    "targetItem": "tm", /* 🌟修正：ti が被っていたので tm に変更！ */
    "targetCount": "tc", "trueNext": "tn", "falseNext": "fnx",
    "clearMode": "cm", "keepMoney": "km", "keepItems": "ki", "keepChars": "kc", "loopNext": "ln"

};
const REVERSE_KEY_DICT = Object.fromEntries(Object.entries(KEY_DICT).map(([k, v]) => [v, k]));

window.packScenario = function (scenario) {
    const packed = {};
    for (let sceneId in scenario) {
        packed[sceneId] = scenario[sceneId].map(step => {
            if (step._packed) return step; // 圧縮済みならスキップ
            
            let pStep = { _packed: 1 };
            for (let key in step) {
                // 🌟修正：false や 0 を消してしまうと設定がバグるので、純粋な空文字と未定義だけを弾く
                if (step[key] !== undefined && step[key] !== "") {
                    let shortKey = KEY_DICT[key] || key; 
                    
                    if (key === "type") pStep[shortKey] = TYPE_SHORT[step[key]] || step[key];
                    else pStep[shortKey] = step[key];
                }
            }
            return pStep;
        });
    }
    return packed;
};

window.unpackScenario = function (packedScenario) {
    const unpacked = {};
    for (let sceneId in packedScenario) {
        unpacked[sceneId] = packedScenario[sceneId].map(pStep => {
            if (!pStep._packed) return pStep; 

            let step = {};
            for (let shortKey in pStep) {
                if (shortKey === "_packed") continue;
                
                let originalKey = REVERSE_KEY_DICT[shortKey] || shortKey;
                
                if (originalKey === "type") step[originalKey] = TYPE_LONG[pStep[shortKey]] || pStep[shortKey];
                else step[originalKey] = pStep[shortKey];
            }
            return step;
        });
    }
    return unpacked;
};
// ==========================================
// エディタ専用・絶対安心オートセーブ機能
// ==========================================

// 1分ごとにエディタの現在の状態をブラウザのローカルストレージに自動保存
setInterval(() => {
    // エディタ画面が開かれている時のみ実行
    if (!document.getElementById("view-editor").classList.contains("active")) return;
    if (isBatchLoading) return;

    try {
        const dataObj = getEditorJSONData();
        // シナリオが1つでもあれば保存する
        if (dataObj && dataObj.json && Object.keys(dataObj.json.SCENARIO || {}).length > 0) {
            localStorage.setItem("anko_editor_backup", JSON.stringify(dataObj.json));
            console.log("エディタの自動バックアップを保存しました。");
        }
    } catch (e) {
        console.error("オートセーブ中にエラー:", e);
    }
}, 60000); // 60000ミリ秒 = 1分

// ==========================================
// エディタ専用・絶対安心オートセーブ機能 (容量制限付き)
// ==========================================

const MAX_BACKUP_HISTORY = 5; // 最新5件まで保存

// 1分ごとにエディタの現在の状態を IndexedDB に自動保存
setInterval(async () => {
    // エディタ画面が開かれている時のみ実行
    if (!document.getElementById("view-editor").classList.contains("active")) return;
    if (isBatchLoading) return;

    try {
        const dataObj = getEditorJSONData();
        // シナリオが1つでもあれば保存する
        if (dataObj && dataObj.json && Object.keys(dataObj.json.SCENARIO || {}).length > 0) {
            
            // 現在の履歴リストを取得
            let historyList = await loadFromIndexedDB(STORE_EDITOR, 'history_list') || [];
            
            // タイムスタンプをキーにして保存
            const timestamp = Date.now();
            await saveToIndexedDB(STORE_EDITOR, `backup_${timestamp}`, dataObj.json);
            
            // リストに追加
            historyList.push(timestamp);
            
            // 🌟 修正：上限（5件）を超えた古いバックアップを削除して容量肥大化を防ぐ
            if (historyList.length > MAX_BACKUP_HISTORY) {
                const oldest = historyList.shift(); // 先頭（一番古いもの）を取り出す
                await deleteFromIndexedDB(STORE_EDITOR, `backup_${oldest}`);
            }
            
            // 更新したリストを保存
            await saveToIndexedDB(STORE_EDITOR, 'history_list', historyList);
            console.log(`エディタの自動バックアップを保存しました。(全${historyList.length}件)`);
        }
    } catch (e) {
        console.error("オートセーブ中にエラー:", e);
    }
}, 60000); // 60000ミリ秒 = 1分

// 自動保存されたデータを復元する機能（最新のものを読み込む）
window.restoreEditorBackup = async function () {
    try {
        const historyList = await loadFromIndexedDB(STORE_EDITOR, 'history_list') || [];
        if (historyList.length === 0) {
            alert("バックアップデータが見つかりません。（まだ1分経過していないか、保存されていません）");
            return;
        }

        if (confirm("⚠️ ブラウザに自動保存された【最新のバックアップ】を復元しますか？\n現在エディタに入力されている内容は上書きされます！")) {
            // リストの最後（一番新しいもの）のキーを取得
            const latestTimestamp = historyList[historyList.length - 1];
            const backupData = await loadFromIndexedDB(STORE_EDITOR, `backup_${latestTimestamp}`);
            
            if (backupData) {
                loadDataToEditorUI(backupData);
                alert("✅ バックアップの復元に成功しました！");
            } else {
                alert("❌ バックアップデータが破損しています。");
            }
        }
    } catch (e) {
        console.error(e);
        alert("❌ データベースの読み込みに失敗しました。");
    }
};


// ==========================================
// 📊 シナリオ・フローチャート視覚化機能
// ==========================================
window.refreshFlowchartData = function () {
    if (!flowchartNetwork) return; 

    const flowModal = document.getElementById('flowchart-modal');
    if (flowModal && flowModal.style.display !== 'flex') return; 

    const editorData = getEditorJSONData().json;
    const scenario = editorData.SCENARIO;
    if (!scenario) return;

    const nodes =[];
    const edges =[];
    const sceneIds = Object.keys(scenario);
    const existingNodes = new Set(sceneIds);
    const errorNodes = new Set();

    sceneIds.forEach((sid, index) => {
        const steps = scenario[sid];
        if (!Array.isArray(steps)) return;

        let isEnd = false;
        const addEdge = (toId, labelText, colorCode) => {
            if (!toId || toId.trim() === "") return; 
            
            // 🌟 修正：マップイベントなどの確率表記 (例: 20%battle_wild) から、シーン名だけを取り出す
            let targetId = toId.trim();
            if (targetId.includes('%')) {
                targetId = targetId.split('%')[1].trim();
            }

            edges.push({
                from: sid,
                to: targetId,
                label: labelText,
                color: { color: colorCode || '#3182ce' },
                arrows: 'to',
                font: { size: 10, align: 'horizontal', background: '#ffffff' }
            });
            
            if (!existingNodes.has(targetId)) errorNodes.add(targetId);
        };

        steps.forEach(step => {
            if (!step) return;
            if (step.type === 'end') isEnd = true;

            if (step.type === 'jump') addEdge(step.next, 'ジャンプ');
                // 🌟 追加：endノードがloopかkeepの場合、次のシーンへの矢印を紫の破線で描く
                if (step.type === 'end' && (step.clearMode === 'loop' || step.clearMode === 'keep')) {
                    addEdge(step.loopNext, 'クリア後', '#805ad5', true);
                }
            if (step.type === 'choice' && Array.isArray(step.choices)) {
                step.choices.forEach(c => addEdge(c.next, c.text));
            }
            
            if (step.type === 'dice_choice' && Array.isArray(step.options)) {
                step.options.forEach(o => addEdge(o.next, `${o.min}〜${o.max}`));
            }
            
            if (step.type === 'flag_check') {
                addEdge(step.true_next, '条件クリア', '#38a169');
                addEdge(step.false_next, '条件未達', '#e53e3e');
            }

            if (step.type === 'battle') {
                addEdge(step.win, '勝利', '#3182ce');
                addEdge(step.lose, '敗北', '#e53e3e');
                addEdge(step.draw, '相打ち', '#805ad5');
                addEdge(step.escape, '逃走', '#d69e2e');
                addEdge(step.scout, '捕獲', '#38a169');
            }

            if (step.type === 'minigame') { 
                addEdge(step.nextScene, '完了', '#3182ce'); 
                addEdge(step.failScene, '失敗', '#e53e3e'); 
            }

            if (step.type === 'craft') { 
                addEdge(step.trueNext, '達成', '#38a169'); 
                addEdge(step.falseNext, '未達成', '#e53e3e'); 
            }

            // マップイベント
            if (step.type === 'map' && step.events) {
                step.events.split(",").forEach(e => {
                    let parts = e.split(":");
                    if (parts.length >= 2) addEdge(parts[1].trim(), `MAP: ${parts[0].trim()}`);
                });
            }
        });

        let bgColor = '#ebf8ff'; let borderColor = '#3182ce';
        if (index === 0) { bgColor = '#c6f6d5'; borderColor = '#38a169'; }
        else if (isEnd) { bgColor = '#e2e8f0'; borderColor = '#4a5568'; }

        let nodeDef = { id: sid, label: `<b>${sid}</b>`, color: { background: bgColor, border: borderColor }, font: { color: '#2d3748', multi: true }, shape: 'box', borderWidth: 2, shadow: true };
        if (window.flowchartLayout && window.flowchartLayout[sid]) {
            nodeDef.x = window.flowchartLayout[sid].x * 50; 
            nodeDef.y = window.flowchartLayout[sid].y * 50;
            nodeDef.physics = false; 
        }
        nodes.push(nodeDef);
    });

    errorNodes.forEach(errId => {
        nodes.push({ id: errId, label: `<b>⚠️ ${errId}</b>\n(未作成)`, color: { background: '#fed7d7', border: '#e53e3e' }, font: { color: '#c53030', multi: true }, shape: 'box', borderWidth: 3, dashes: true });
    });

    flowchartNetwork.setData({ nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) });
};


// ==========================================
// 📊 フローチャート機能（拡張版：色分け＆ツリーレイアウト）
// ==========================================

let flowchartNetwork = null;
let isHierarchicalLayout = false; // ツリーレイアウトかどうかのフラグ
window.flowchartLayout = {}; // 手動で動かしたノードの座標を記憶するオブジェクト (グリッド単位)

const GRID_SIZE = 50; // 座標を圧縮するためのマス目の大きさ
function getNodeColors(sceneId, isStart, isEnd) {
    if (isStart) return { background: '#c6f6d5', border: '#38a169' };
    if (isEnd) return { background: '#e2e8f0', border: '#4a5568' };
    const prefix = sceneId.split('_')[0].toLowerCase();
    switch (prefix) {
        case 'town': case 'shop': case 'inn': return { background: '#bee3f8', border: '#3182ce' };
        case 'boss': case 'battle': case 'enemy': return { background: '#fed7d7', border: '#e53e3e' };
        case 'dungeon': case 'cave': case 'forest': return { background: '#feebc8', border: '#d69e2e' };
        case 'event': case 'talk': case 'story': return { background: '#e9d8fd', border: '#805ad5' };
        default: return { background: '#ffffff', border: '#a0aec0' };
    }
}

window.toggleFlowchartLayout = function () {
    isHierarchicalLayout = !isHierarchicalLayout;
    const btn = document.getElementById('btn-toggle-layout');
    if (isHierarchicalLayout) { btn.innerText = "🌌 物理演算に戻す"; btn.className = "btn-warning btn-sm"; }
    else { btn.innerText = "🌲 階層表示にする"; btn.className = "btn-info btn-sm"; }
    openFlowchart();
};

window.openFlowchart = function () {
    // 🌟 追加：visライブラリが読み込めていない場合はブロック
    if (typeof vis === 'undefined') {
        alert("⚠️ 図を描画するプログラムが読み込めませんでした。\nインターネット接続を確認してください。（オフラインでは動作しません）");
        return;
    }

    try {
        const editorData = getEditorJSONData().json;
        const scenario = editorData.SCENARIO;

        if (!scenario || Object.keys(scenario).length === 0) {
            alert("可視化するシナリオデータがありません！\n先にシーンを作成してください。"); return;
        }

        const nodes = []; const edges = [];
        const sceneIds = Object.keys(scenario);
        const existingNodes = new Set(sceneIds);
        const errorNodes = new Set();
        const targetedNodes = new Set();

        sceneIds.forEach((sid, index) => {
            const steps = scenario[sid];
            if (!Array.isArray(steps)) return;

            let isEnd = false;
            const addEdge = (toId, labelText, colorCode, isDashed) => {
                if (!toId) return;
                
                let targetId = toId.trim();
                // 🌟 マップのランダムエンカウント (20%battle_wild 等) からシーンIDだけを抽出
                if (targetId.includes('%')) {
                    targetId = targetId.split('%')[1].trim();
                }

                targetedNodes.add(targetId);

                // 🌟 修正：同じ行き先の矢印がすでにある場合は線を増やさず、文字(ラベル)を合体させる
                let existingEdge = edges.find(e => e.from === sid && e.to === targetId);
                if (existingEdge) {
                    // すでに同じ文字が含まれていなければスラッシュで繋いで追記する
                    if (!existingEdge.label.includes(labelText)) {
                        existingEdge.label += ` / ${labelText}`;
                    }
                } else {
                    edges.push({
                        from: sid, to: targetId, label: labelText,
                        color: { color: colorCode || '#a0aec0' }, dashes: isDashed || false, arrows: 'to',
                        font: { size: 10, align: 'horizontal', background: '#ffffff' }
                    });
                }
                
                if (!existingNodes.has(targetId)) errorNodes.add(targetId);
            };

            steps.forEach(step => {
                if (!step) return;
                if (step.type === 'end') isEnd = true;
                if (step.type === 'jump') addEdge(step.next, 'ジャンプ');
                if (step.type === 'choice' && Array.isArray(step.choices)) step.choices.forEach(c => addEdge(c.next, c.text));
                if (step.type === 'dice_choice' && Array.isArray(step.options)) step.options.forEach(o => addEdge(o.next, `${o.min}〜${o.max}`));
                if (step.type === 'flag_check') { addEdge(step.true_next, '条件クリア', '#38a169'); addEdge(step.false_next, '条件未達', '#e53e3e'); }
                if (step.type === 'battle') { addEdge(step.win, '勝利', '#3182ce'); addEdge(step.lose, '敗北', '#e53e3e'); addEdge(step.draw, '相打ち', '#805ad5'); addEdge(step.escape, '逃走', '#d69e2e'); addEdge(step.scout, '捕獲', '#38a169'); }
                if (step.type === 'map' && step.events) step.events.split(",").forEach(e => { let parts = e.split(":"); if (parts.length >= 2) addEdge(parts[1].trim(), `MAP: ${parts[0].trim()}`); });
                
                // ▼ここを追加（ミニゲームとクラフトの矢印を生成する）
                if (step.type === 'minigame') { addEdge(step.nextScene, '完了', '#3182ce'); addEdge(step.failScene, '失敗', '#e53e3e'); }
                if (step.type === 'craft') { addEdge(step.trueNext, '達成', '#38a169'); addEdge(step.falseNext, '未達成', '#e53e3e'); }
            });
            const colors = getNodeColors(sid, index === 0, isEnd);

            // ★ ノードの定義（記憶している座標があれば適用し、物理演算でフワフワ飛ばないように固定する）
            let nodeDef = {
                id: sid, label: `<b>${sid}</b>`, color: colors,
                font: { color: '#2d3748', multi: true }, shape: 'box', borderWidth: 2, shadow: true
            };
            if (window.flowchartLayout[sid]) {
                nodeDef.x = window.flowchartLayout[sid].x * GRID_SIZE;
                nodeDef.y = window.flowchartLayout[sid].y * GRID_SIZE;
                // 🌟修正：完全固定ではなく、物理演算だけをオフにしてドラッグ可能にする
                nodeDef.physics = false;
            }
            nodes.push(nodeDef);
        });

        errorNodes.forEach(errId => nodes.push({ id: errId, label: `<b>⚠️ ${errId}</b>\n(未作成)`, color: { background: '#fed7d7', border: '#e53e3e' }, font: { color: '#c53030', multi: true }, shape: 'box', borderWidth: 3, dashes: true }));
        nodes.forEach((node, idx) => { if (idx > 0 && !targetedNodes.has(node.id) && !errorNodes.has(node.id)) { node.color.background = '#edf2f7'; node.color.border = '#a0aec0'; node.label = `${node.id}\n(孤立)`; } });

        document.getElementById('flowchart-modal').style.display = 'flex';

        setTimeout(() => {
            const container = document.getElementById('flowchart-network');
            if (!container) return;

            let options = {};
            if (isHierarchicalLayout) {
                options = {
                    layout: { hierarchical: { direction: "UD", sortMethod: "directed", nodeSpacing: 150, levelSeparation: 150 } },
                    physics: { enabled: false }, edges: { smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 } }
                };
            } else {
                // 物理演算を少し弱めにして、手動配置を邪魔しないようにする
                options = {
                    physics: { stabilization: true, barnesHut: { gravitationalConstant: -1000, springLength: 200, springConstant: 0.02 } },
                    layout: { randomSeed: 2 }, edges: { smooth: { type: 'dynamic', roundness: 0.5 } }
                };
            }

            if (flowchartNetwork) flowchartNetwork.destroy();
            flowchartNetwork = new vis.Network(container, { nodes, edges }, options);

            // ★ クリックでエディタに移動
            flowchartNetwork.on("click", function (params) {
                if (params.nodes.length > 0) {
                    const clickedId = params.nodes[0];
                    if (existingNodes.has(clickedId)) { closeFlowchart(); jumpToSceneInEditor(clickedId); }
                }
            });
            flowchartNetwork.on("dragEnd", function () {
                if (!isHierarchicalLayout) {
                    const positions = flowchartNetwork.getPositions();
                    for (let id in positions) {
                        window.flowchartLayout[id] = {
                            x: Math.round(positions[id].x / GRID_SIZE),
                            y: Math.round(positions[id].y / GRID_SIZE)
                        };
                    }
                }
            });

        }, 50);

    } catch (e) { console.error(e); }
};
window.closeFlowchart = function () { document.getElementById('flowchart-modal').style.display = 'none'; };
window.jumpToSceneInEditor = function (sceneId) {
    toggleAllScenes(false); const sceneBlock = document.getElementById(`scene-block-${sceneId}`);
    if (sceneBlock) {
        sceneBlock.classList.remove('scene-collapsed'); sceneBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sceneBlock.style.transition = 'box-shadow 0.3s, transform 0.3s'; sceneBlock.style.transform = 'scale(1.02)';
        sceneBlock.style.boxShadow = '0 0 20px #ecc94b'; sceneBlock.style.zIndex = '10'; sceneBlock.style.position = 'relative';
        setTimeout(() => { sceneBlock.style.transform = 'scale(1)'; sceneBlock.style.boxShadow = ''; sceneBlock.style.zIndex = ''; }, 1500);
    }
};


// Escキーでフローチャートを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const flowModal = document.getElementById('flowchart-modal'); if (flowModal && flowModal.style.display === 'flex') closeFlowchart(); }
});
// ==========================================
// 🐞 シナリオ自動デバッガー（バグ検知機能）
// ==========================================

window.runFlowchartDebugger = function () {
    if (typeof vis === 'undefined') {
        alert("⚠️ オフラインのため、デバッガーを起動できません。");
        return;
    }
    if (!flowchartNetwork) return;

    const editorData = getEditorJSONData().json;
    const scenario = editorData.SCENARIO;
    if (!scenario) return;

    const sceneIds = Object.keys(scenario);

    const adjList = {};       
    const hasEnd = new Set(); 
    const setFlags = new Set(); 
    const checkFlags = {};    
    const emptyScenes = new Set(); 

    sceneIds.forEach(sid => {
        adjList[sid] = [];
        const steps = scenario[sid];
        if (!Array.isArray(steps) || steps.length === 0) {
            emptyScenes.add(sid);
            return;
        }

        steps.forEach(step => {
            if (!step || !step.type) return;

            if (step.type === 'end') hasEnd.add(sid);

            const addEdge = (to) => { 
                if (!to || to.trim() === "") return;
                let dest = to.trim();
                // 🌟 マップイベントの確率表記 (20%battle_wild) からシーン名のみを抽出
                if (dest.includes('%')) {
                    dest = dest.split('%')[1].trim();
                }
                if (!adjList[sid].includes(dest)) adjList[sid].push(dest); 
            };

            if (step.type === 'jump') addEdge(step.next);
            if (step.type === 'choice' && step.choices) step.choices.forEach(c => addEdge(c.next));
            if (step.type === 'dice_choice' && step.options) step.options.forEach(o => addEdge(o.next));
            if (step.type === 'flag_check') {
                addEdge(step.true_next); addEdge(step.false_next);
                if (step.flagName) {
                    if (!checkFlags[sid]) checkFlags[sid] = [];
                    checkFlags[sid].push(step.flagName);
                }
            }
            if (step.type === 'battle') { 
                addEdge(step.win); addEdge(step.lose); addEdge(step.draw); addEdge(step.escape); addEdge(step.scout); 
            }
            if (step.type === 'map' && step.events) {
                step.events.split(",").forEach(e => { let p = e.split(":"); if (p.length >= 2) addEdge(p[1].trim()); });
            }
            
            if (step.type === 'minigame') { 
                if (step.nextScene) {
                    addEdge(step.nextScene);
                } else {
                    let lastStep = steps[steps.length - 1];
                    if (lastStep.type === 'jump') addEdge(lastStep.next);
                    else if (lastStep.type === 'end') hasEnd.add(sid);
                }
                addEdge(step.failScene); 
            }
            
            if (step.type === 'craft') { 
                if (step.trueNext) {
                    addEdge(step.trueNext);
                } else {
                    let lastStep = steps[steps.length - 1];
                    if (lastStep.type === 'jump') addEdge(lastStep.next);
                    else if (lastStep.type === 'end') hasEnd.add(sid);
                }
                addEdge(step.falseNext); 
            }
            if (step.type === 'flag_set' && step.flagName) {
                setFlags.add(step.flagName);
            }
        });
    });

    // 2. エンディングから逆走してゴールに辿り着けるかチェックする (BFS)
    const reverseAdjList = {};
    sceneIds.forEach(sid => { reverseAdjList[sid] = []; });
    
    sceneIds.forEach(sid => {
        (adjList[sid] || []).forEach(next => {
            if (reverseAdjList[next]) reverseAdjList[next].push(sid);
        });
    });

    const canReachEnd = {};
    sceneIds.forEach(sid => { canReachEnd[sid] = false; });

    const queue = Array.from(hasEnd);
    queue.forEach(sid => { canReachEnd[sid] = true; });

    let head = 0;
    while (head < queue.length) {
        const current = queue[head++];
        const prevNodes = reverseAdjList[current] || [];
        for (let prev of prevNodes) {
            if (!canReachEnd[prev]) {
                canReachEnd[prev] = true;
                queue.push(prev);
            }
        }
    }
    const currentNodes = flowchartNetwork.body.data.nodes;
    const updates =[];
    let bugCount = 0;

    sceneIds.forEach(sid => {
        let isBug = false;
        let bugMsgs =[];
        let icon = "";

        if (emptyScenes.has(sid)) {
            isBug = true; bugMsgs.push("中身がカラッポ(フリーズします)"); icon = "🈳 ";
        }

        if (checkFlags[sid]) {
            const missingFlags = checkFlags[sid].filter(f => !f.startsWith("G_") && !setFlags.has(f));
            if (missingFlags.length > 0) {
                isBug = true; bugMsgs.push(`存在しないフラグをチェック: ${missingFlags.join(", ")}`); icon += "🚩 ";
            }
        }

        if (!canReachEnd[sid] && !emptyScenes.has(sid)) {
            isBug = true; bugMsgs.push("無限ループ(エンディングに辿り着けません)"); icon += "💀 ";
        }

        if (isBug) {
            bugCount++;
            updates.push({
                id: sid,
                label: `<b>${icon}${sid}</b>\n${bugMsgs[0]}`, 
                color: { background: '#fed7d7', border: '#e53e3e' },
                font: { multi: true }, 
                borderWidth: 4,
                title: bugMsgs.join("\n") 
            });
        } else {
            // エラーが解消された場合は元の色に戻す
            const colors = getNodeColors(sid, false, hasEnd.has(sid));
            updates.push({
                id: sid,
                label: `<b>${sid}</b>`, 
                color: colors,
                borderWidth: 2,
                title: ""
            });
        }
    });

    if (updates.length > 0) {
        currentNodes.update(updates);

        if (bugCount > 0) {
            const canvas = document.getElementById('flowchart-network');
            canvas.style.transform = 'translate(-10px, 0)';
            setTimeout(() => canvas.style.transform = 'translate(10px, 0)', 50);
            setTimeout(() => canvas.style.transform = 'translate(-10px, 0)', 100);
            setTimeout(() => canvas.style.transform = 'translate(0, 0)', 150);

            alert(`🚨 警告！ ${bugCount} 個のシーンから「進行不能バグ」を検知しました！\n\n図の中で赤く表示された箱（💀や🚩）をチェックしてください。マウスを乗せるとエラーの原因が見れます。箱をクリックすればエディタで直接直せます！`);
        } else {
            alert("✨ 素晴らしい！完璧です！\n無限ループやフラグの矛盾などの致命的バグは一切検知されませんでした。\nこのシナリオは最後まで安全にプレイ可能です！");
        }
    }
};
// ==========================================
// スマホ対応：ボタンによる要素の並べ替え処理
// ==========================================
window.moveElement = function (btn, direction) {
    // ボタンの親要素（ステップまたはシーン全体）を取得
    const el = btn.closest('.step-block, .scene-block');
    if (!el) return;

    if (direction === -1 && el.previousElementSibling) {
        // 1つ上へ移動
        el.parentNode.insertBefore(el, el.previousElementSibling);
    } else if (direction === 1 && el.nextElementSibling) {
        // 1つ下へ移動
        el.parentNode.insertBefore(el.nextElementSibling, el);
    }
    // 順番が変わったのでフローチャートなどを更新
    updateDatalists();
    pushHistory();
};

// ==========================================
// 🔍 エディタ：シーン検索機能
// ==========================================
window.filterEditorItems = function () {
    const input = document.getElementById("editor-search-input");
    if (!input) return;
    const query = input.value.toLowerCase().trim();

    // 現在アクティブなタブを探す
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;

    // 検索対象は、シナリオなら .scene-block 、それ以外なら .step-block
    const isScenario = activeTab.id === "tab-scenario";
    const blocks = activeTab.querySelectorAll(isScenario ? ".scene-block" : ".step-block");

    blocks.forEach(block => {
        if (!query) {
            block.style.display = "block"; // 空なら全部表示
            return;
        }

        // ブロックの中にあるすべての入力値（ID, 名前, セリフなど）を結合して検索する
        let blockText = "";
        
        if (isScenario) {
            blockText += block.getAttribute("data-scene-id").toLowerCase() + " ";
        }
        
        // input, textarea, select の値をすべて拾う
        block.querySelectorAll("input, textarea, select").forEach(inp => {
            blockText += (inp.value || "").toLowerCase() + " ";
        });

        if (blockText.includes(query)) {
            block.style.display = "block";
            // シナリオの場合は見やすいように枠を開く
            if (isScenario) block.classList.remove('scene-collapsed');
        } else {
            block.style.display = "none";
        }
    });
};

window.editorUpdateStatChangeUI = function (selectEl) {
    const block = selectEl.closest('.step-block');
    if (!block) return;
    const mode = selectEl.value;
    const statSelect = block.querySelector('.step-data[data-key="statKey"]');
    if (!statSelect) return;

    let html = "";
    if (mode === "recover") {
        html = `
            <optgroup label="■ 現在値・リソースの増減">
                <option value="hp">現在の HP</option>
                <option value="mp">現在の 魔力(MP)</option>
                <option value="st">現在の スタミナ(ST)</option>
                <option value="money">所持金 (G) ※対象指定無視</option>
                <option value="orb_shinsei">新生の宝珠 (個) ※対象指定無視</option>
                <option value="exp_pool">経験値 (EXP)</option>
                <option value="sp">スキルポイント (SP)</option>
                <option value="curShock">現在の 衝撃耐性</option>
                <option value="curHeat">現在の 熱量耐性</option>
                <option value="curElec">現在の 電磁耐性</option>
            </optgroup>`;
    } else if (mode === "growth") {
        html = `
            <optgroup label="■ 基礎ステータス・上限の増減">
                <option value="maxHp">最大HP</option>
                <option value="maxMp">最大MP</option>
                <option value="maxSt">最大ST</option>
                <option value="tech">技術 (tech)</option>
                <option value="exp">経験 (exp)</option>
                <option value="baseDmg">基礎攻撃力</option>
                <option value="baseDef">基礎防御力</option>
                <option value="atkShock">衝攻 (ATK)</option>
                <option value="atkHeat">熱攻 (ATK)</option>
                <option value="atkElec">電攻 (ATK)</option>
                <option value="maxShock">MAX 衝撃耐性</option>
                <option value="maxHeat">MAX 熱量耐性</option>
                <option value="maxElec">MAX 電磁耐性</option>
                <option value="recShock">回復(REC) 衝撃</option>
                <option value="recHeat">回復(REC) 熱量</option>
                <option value="recElec">回復(REC) 電磁</option>
            </optgroup>`;
    } else if (mode === "set") {
        html = `
            <optgroup label="■ 数値の強制代入">
                <option value="hp">現在の HP (回復ではない)</option>
                <option value="mp">現在の 魔力(MP)</option>
                <option value="st">現在の スタミナ(ST)</option>
                <option value="money">所持金 (G)</option>
                <option value="orb_shinsei">新生の宝珠 (個)</option>
            </optgroup>
            <optgroup label="■ 属性相性の上書き (文字代入)">
                <option value="aff_fire">相性: 火炎</option><option value="aff_elec">相性: 電撃</option><option value="aff_ice">相性: 氷結</option>
                <option value="aff_wind">相性: 疾風</option><option value="aff_water">相性: 水流</option><option value="aff_earth">相性: 大地</option>
                <option value="aff_bomb">相性: 爆破</option><option value="aff_dark">相性: 暗黒</option><option value="aff_wave">相性: 波動</option>
                <option value="aff_light">相性: 白光</option><option value="aff_mystic">相性: 神秘</option><option value="aff_spirit">相性: 霊気</option>
                <option value="aff_gravity">相性: 重力</option><option value="aff_fight">相性: 格闘</option><option value="aff_grass">相性: 草花</option>
            </optgroup>`;
    }
    
    const currentVal = statSelect.value;
    statSelect.innerHTML = html;
    const exists = Array.from(statSelect.options).some(opt => opt.value === currentVal);
    if (exists) statSelect.value = currentVal;
};
// エディタ用：ミニゲームの種類に応じて入力欄を切り替える
window.editorUpdateMinigameUI = function (selectEl) {
    const block = selectEl.closest('.step-block');
    if (!block) return;
    const type = selectEl.value;
    const actionUI = block.querySelector('.mg-action-ui');
    
    if (actionUI) {
        // カジノ系（slot, roulette, poker）以外なら、難易度・報酬UIを表示する
        if (type === "gauge" || type === "qte" || type === "mash" || type === "tetris") {
            actionUI.style.display = "block";
        } else {
            actionUI.style.display = "none";
        }
    }
};

// ==========================================
// 🌟 最適化：ステップの入力欄を復元する共通関数
// ==========================================
function fillStepInputs(step, inputs) {
    if (!step || !inputs || inputs.length === 0) return;

    if (step.type === "system_set") {
        const boolKeys =[
            "enableLevelUp", "enableResistance", "enableAttribute", "enableStatus", 
            "enablePartyBattle", "enableTactical", "enableAnalyze", "skipHitDice", 
            "enableItemUse", "enableEquipChange", "enableEscape", "enableScout", 
            "enableTimeSystem", "enablePermaDeath", "enableSpReset", "enableMultiEquip", 
            "enableTension", "enableMpSt", "enableEvolution" // 🌟 追加
        ];

        boolKeys.forEach((key, i) => {
            // 新規追加された項目でデータがない場合はデフォルトを true にする
            let defValue = (key === "enableEvolution") ? true : false;
            if (inputs[i]) inputs[i].checked = step[key] !== undefined ? step[key] : defValue;
        });

        // 🌟 インデックスのズレを調整
        if (inputs[19]) inputs[19].value = step.maxLevel || 0;
        if (inputs[20]) inputs[20].value = step.maxItemCount || 0;
        if (inputs[21]) inputs[21].value = step.maxSkills || 0;
        if (inputs[22]) inputs[22].value = step.maxPlayerCount || 50;
        if (inputs[23]) inputs[23].value = step.battleMemberCount || 3; 
        if (inputs[24]) inputs[24].value = step.maxEquipCount || 1; 
        if (inputs[25]) inputs[25].value = step.timeLimit || 0;
        if (inputs[26]) inputs[26].value = step.turnLimit || 0;
        if (inputs[27]) inputs[27].value = step.maxPartyCost || 0;
    }
    // 🌟 修正：メッセージ系のAA復元処理のバグを修正
    else if (step.type === "msg") { 
        if (inputs[0]) inputs[0].value = step.speaker || ""; 
        if (inputs[1]) {
            inputs[1].value = window.decodeAA(step.aa || "");
            updateAAPreview(inputs[1]);
        }
        if (inputs[2]) inputs[2].value = step.text || ""; 
    }
    else if (step.type === "choice") { 
        if (step.choices && Array.isArray(step.choices)) {
            for (let i = 0; i < 4; i++) {
                if (step.choices[i] && inputs[i * 2] && inputs[i * 2 + 1]) {
                    inputs[i * 2].value = step.choices[i].text || "";
                    inputs[i * 2 + 1].value = step.choices[i].next || "";
                }
            }
        }
    }

    else if (step.type === "battle") { 
        if (inputs[0]) inputs[0].value = step.enemies ? step.enemies.join(",") : ""; 
        if (inputs[1]) inputs[1].value = step.initiative || "stats"; 
        if (inputs[2]) inputs[2].value = step.mapData || "";
        if (inputs[3]) inputs[3].value = step.win || ""; 
        if (inputs[4]) inputs[4].value = step.lose || ""; 
        if (inputs[5]) inputs[5].value = step.draw || ""; 
        if (inputs[6]) inputs[6].value = step.escape || ""; 
        if (inputs[7]) inputs[7].value = step.scout || ""; 
    }
    else if (step.type === "jump") { if (inputs[0]) inputs[0].value = step.next || ""; }
    else if (step.type === "shop") { if (inputs[0]) inputs[0].value = step.items ? step.items.join(",") : ""; }
    else if (step.type === "give") { 
        if (inputs[0]) inputs[0].value = step.target || ""; 
        if (inputs[1]) inputs[1].value = step.amount || 1; 
    }
    else if (step.type === "flag_set") { 
        if (inputs[0]) inputs[0].value = step.targetId || ""; 
        if (inputs[1]) inputs[1].value = step.flagName || ""; 
        if (inputs[2]) inputs[2].value = step.operator || "="; 
        if (inputs[3]) inputs[3].value = step.flagValue || ""; 
    }
    else if (step.type === "flag_check") { 
        if (inputs[0]) inputs[0].value = step.targetId || ""; 
        if (inputs[1]) inputs[1].value = step.flagName || ""; 
        if (inputs[2]) inputs[2].value = step.condition || "=="; 
        if (inputs[3]) inputs[3].value = step.flagValue || ""; 
        if (inputs[4]) inputs[4].value = step.true_next || ""; 
        if (inputs[5]) inputs[5].value = step.false_next || ""; 
    }
    else if (step.type === "stat_change") { 
        if (inputs[0]) inputs[0].value = step.targetId || "";
        if (inputs[1]) inputs[1].value = step.mode || "recover"; 
        
        if (inputs[2]) inputs[2].value = step.statKey || "hp"; 
        if (inputs[3]) inputs[3].value = step.amount !== undefined ? step.amount : 0; 
        if (inputs[4]) inputs[4].value = step.msg || ""; 
    }
    else if (step.type === "job_change") {
        if (inputs[0]) inputs[0].value = step.targetId || "";
        if (inputs[1]) inputs[1].value = step.jobId || "";
    }
    else if (step.type === "join_party") {
        if (inputs[0]) inputs[0].value = step.targetId || "";
        if (inputs[1]) inputs[1].value = step.msg || "";
    }
    else if (step.type === "minigame") { 
        if (inputs[0]) inputs[0].value = step.gameType || "slot"; 
        if (inputs[1]) inputs[1].value = step.mgTitle || "";
        if (inputs[2]) inputs[2].value = step.betType || "money"; 
        if (inputs[3]) inputs[3].value = step.targetId || ""; 
        if (inputs[4]) inputs[4].value = step.betAmount || 0; 
        if (inputs[5]) inputs[5].value = step.playLimit || 0; 
        if (inputs[6]) inputs[6].value = step.nextScene || ""; 
        if (inputs[7]) inputs[7].value = step.failScene || ""; 
        if (inputs[8]) inputs[8].checked = step.requireSuccess || false; 
        if (inputs[9]) inputs[9].value = step.difficulty || 3; 
        if (inputs[10]) inputs[10].value = step.rewards || ""; 
        if (inputs[0]) editorUpdateMinigameUI(inputs[0]); 
    }
    else if (step.type === "pass_time") { 
        if (inputs[0]) inputs[0].value = step.amount || 1; 
        if (inputs[1]) inputs[1].value = step.msg || ""; 
    }
    else if (step.type === "craft") { 
        if (inputs[0]) inputs[0].value = step.title || "アトリエ"; 
        if (inputs[1]) inputs[1].value = step.category || ""; 
        if (inputs[2]) inputs[2].value = step.targetItem || ""; 
        if (inputs[3]) inputs[3].value = step.targetCount || 1; 
        if (inputs[4]) inputs[4].value = step.trueNext || ""; 
        if (inputs[5]) inputs[5].value = step.falseNext || ""; 
    }
    else if (step.type === "bg_set") { 
        if (inputs[0]) {
            inputs[0].value = step.preset || "auto"; 
            const root = inputs[0].closest('.step-body');
            const pickers = root.querySelectorAll('input[type="color"]');
            if(pickers[0] && step.custom_bg && step.custom_bg.startsWith("#")) pickers[0].value = step.custom_bg;
            if(pickers[1] && step.msgBg && step.msgBg.startsWith("#")) pickers[1].value = step.msgBg;
            if(pickers[2] && step.msgText && step.msgText.startsWith("#")) pickers[2].value = step.msgText;
            if(pickers[3] && step.msgSpeaker && step.msgSpeaker.startsWith("#")) pickers[3].value = step.msgSpeaker;
            if (inputs[1]) { inputs[1].value = step.custom_bg || "auto"; inputs[1].disabled = (step.preset !== "custom"); }
            if (inputs[2]) inputs[2].value = step.textColor || "auto"; 
            if (inputs[3]) inputs[3].value = step.msgBg || "rgba(0,0,0,0.85)"; 
            if (inputs[4]) inputs[4].value = step.msgText || "#ffffff"; 
            if (inputs[5]) inputs[5].value = step.msgSpeaker || "#ecc94b";
        }
    }
    else if (step.type === "dice_choice") { 
        if (inputs[0]) inputs[0].value = step.speaker || ""; 
        if (inputs[1]) { inputs[1].value = window.decodeAA(step.aa || ""); updateAAPreview(inputs[1]); }
        if (inputs[2]) inputs[2].value = step.text || ""; 
        if (inputs[3]) inputs[3].value = step.diceMax || 100; 
        if (step.options && Array.isArray(step.options)) {
            if (step.options[0]) {
                if (inputs[4]) inputs[4].value = step.options[0].min || "";
                if (inputs[5]) inputs[5].value = step.options[0].max || "";
                if (inputs[6]) inputs[6].value = step.options[0].next || "";
            }
            if (step.options[1]) {
                if (inputs[7]) inputs[7].value = step.options[1].min || "";
                if (inputs[8]) inputs[8].value = step.options[1].max || "";
                if (inputs[9]) inputs[9].value = step.options[1].next || "";
            }
        }
    }
   else if (step.type === "stat_roll") { 
        if (inputs[0]) inputs[0].value = step.speaker || ""; 
        if (inputs[1]) { inputs[1].value = window.decodeAA(step.aa || ""); updateAAPreview(inputs[1]); }
        if (inputs[2]) inputs[2].value = step.text || ""; 
        if (inputs[3]) inputs[3].value = step.targetId || ""; 
        if (inputs[4]) inputs[4].value = step.rerolls !== undefined ? step.rerolls : 3; 
        
        let rolls = step.rolls || [];[5, 7, 9, 11, 13].forEach((idx, i) => { 
            if (inputs[idx]) inputs[idx].value = rolls[i] ? (rolls[i].key || "none") : "none";
            if (inputs[idx + 1]) inputs[idx + 1].value = rolls[i] ? (rolls[i].exp || "1d100+10") : "1d100+10";
        });
    }
    else if (step.type === "map") { 
        if (inputs[0]) inputs[0].value = step.viewType || "top"; 
        if (inputs[1]) inputs[1].value = step.mapData || ""; 
        if (inputs[2]) inputs[2].value = step.events || ""; 
    }else if (step.type === "end") {
        if (inputs[0]) {
            inputs[0].value = step.clearMode || "delete";
            // 🌟 修正：ロード時にUIの表示/非表示とヒントを強制更新する
            const root = inputs[0].parentElement;
            const opts = root.querySelector('.loop-opts');
            const hint = root.querySelector('.mode-hint');
            
            if (step.clearMode === 'loop') {
                if(opts) opts.style.display = 'block';
                if(hint) { hint.innerText = '【二周目】能力を引き継いで最初からやり直します。物語（フラグ）と日数はリセットされます。'; hint.style.color = '#dd6b20'; }
            } else if (step.clearMode === 'keep') {
                if(opts) opts.style.display = 'none';
                if(hint) { hint.innerText = '【後日談】フラグも日数もそのまま維持し、平和になった世界を冒険し続けます。'; hint.style.color = '#38a169'; }
            } else {
                if(opts) opts.style.display = 'none';
                if(hint) { hint.innerText = '【終了】セーブデータを完全に削除し、タイトル画面へ戻ります。'; hint.style.color = '#718096'; }
            }
        }
        if (inputs[1]) inputs[1].checked = step.keepMoney !== false;
        if (inputs[2]) inputs[2].checked = step.keepItems !== false;
        if (inputs[3]) inputs[3].checked = step.keepChars !== false;
        if (inputs[4]) inputs[4].value = step.loopNext || "start";
    }
}

// ==========================================
// 🧠 敵AIカードの動的追加・削除ロジック
// ==========================================
window.addAiCard = function(btn, loadData = null) {
    const container = btn.previousElementSibling;
    const cardCount = container.children.length + 1;
    
    // ロード時のデータがあればそれを使う、なければデフォルト
    const cond = loadData ? loadData.cond : "none";
    const skill = loadData ? loadData.skill : "normal";
    const prob = loadData ? loadData.prob : 100;

    const cardHtml = `
        <div class="ai-card" style="display:flex; align-items:center; gap:5px; background:#fff; padding:6px; border-radius:4px; border:1px solid #cbd5e0; border-left:4px solid #e53e3e;">
            <span style="font-size:10px; font-weight:bold; color:#718096; cursor:ns-resize;" title="ドラッグで並べ替え">↕️ ${cardCount}</span>
            <select class="ai-cond" style="flex:2; padding:2px; font-size:11px;">
                <option value="none" ${cond === "none" ? "selected" : ""}>設定なし (無効)</option>
                <optgroup label="■ 自分の状態">
                    <option value="hp_75" ${cond === "hp_75" ? "selected" : ""}>自分のHPが 75% 以下</option>
                    <option value="hp_50" ${cond === "hp_50" ? "selected" : ""}>自分のHPが 50% 以下</option>
                    <option value="hp_25" ${cond === "hp_25" ? "selected" : ""}>自分のHPが 25% 以下</option>
                    <option value="status_any" ${cond === "status_any" ? "selected" : ""}>自分が何らかの【状態異常】</option>
                    <option value="my_slip" ${cond === "my_slip" ? "selected" : ""}>自分が【毒・火傷・出血】</option>
                    <option value="my_restrict" ${cond === "my_restrict" ? "selected" : ""}>自分が【麻痺・凍結・鈍足】</option>
                    <option value="break_any" ${cond === "break_any" ? "selected" : ""}>自分が【ブレイク中】</option>
                    <option value="status_none" ${cond === "status_none" ? "selected" : ""}>自分が【健康】(異常なし)</option>
                </optgroup>
                <optgroup label="■ 相手の状態">
                    <option value="target_status_any" ${cond === "target_status_any" ? "selected" : ""}>相手が何らかの【状態異常】</option>
                    <option value="tg_sleep" ${cond === "tg_sleep" ? "selected" : ""}>相手が【睡眠・石化・凍結】</option>
                    <option value="tg_buff" ${cond === "tg_buff" ? "selected" : ""}>相手が【無敵・守護・不動】</option>
                    <option value="target_break_any" ${cond === "target_break_any" ? "selected" : ""}>相手が【ブレイク中】</option>
                </optgroup>
                <optgroup label="■ ターンの経過">
                    <option value="turn_1" ${cond === "turn_1" ? "selected" : ""}>最初の1ターン目</option>
                    <option value="turn_2_mul" ${cond === "turn_2_mul" ? "selected" : ""}>2ターンごと (偶数)</option>
                    <option value="turn_3_mul" ${cond === "turn_3_mul" ? "selected" : ""}>3ターンごと</option>
                    <option value="turn_4_mul" ${cond === "turn_4_mul" ? "selected" : ""}>4ターンごと</option>
                    <option value="turn_5_mul" ${cond === "turn_5_mul" ? "selected" : ""}>5ターンごと</option>
                </optgroup>
                <optgroup label="■ 運・その他">
                    <option value="random_50" ${cond === "random_50" ? "selected" : ""}>50%の確率で気まぐれ</option>
                    <option value="random_25" ${cond === "random_25" ? "selected" : ""}>25%の確率で気まぐれ</option>
                    <option value="always" ${cond === "always" ? "selected" : ""}>常時 (必ず満たす)</option>
                </optgroup>
            </select>
            <span style="font-size:11px;">なら</span>
            
            <!-- 🌟 修正：セレクトボックスを廃止し、予測変換付きの input に変更 -->
            <input type="text" class="ai-skill skill-input" value="${skill}" list="skill-list" placeholder="技IDを入力" style="flex:2; padding:4px; font-size:12px; border:1px solid #cbd5e0; border-radius:4px;">
            
            <input type="number" class="ai-prob" value="${prob}" style="width:40px; padding:2px; text-align:right; font-size:11px; border:1px solid #cbd5e0; border-radius:4px;">
            <span style="font-size:11px;">%</span>
            <button type="button" class="btn-danger btn-sm" style="padding:2px 6px;" onclick="this.parentElement.remove(); updateAiCardsData(this);">&times;</button>
        </div>
    `;
    
    // HTMLを追加
    container.insertAdjacentHTML('beforeend', cardHtml);
    
    // サジェストの更新
    if (typeof updateDatalists === "function") updateDatalists();
    
    // 追加された瞬間に、隠しフィールドのJSONも更新する
    updateAiCardsData(container);
};

// カードの中身が変更された時、または追加・削除された時に、隠しフィールドにJSON配列として保存する
// 同時に、AIで使われている全ての技を抽出して「習得技(skills)リスト」を自動生成する
window.updateAiCardsData = function(element) {
    const root = element.closest('.step-block');
    if (!root) return;
    
    // 1. AIカードのJSON保存
    const container = root.querySelector('.ai-cards-container');
    const hiddenInput = root.querySelector('.enemy-data[data-key="ai_cards"]');
    let cardsData = [];
    let usedSkills = new Set(); // 重複を防ぐためのセット

    if (container && hiddenInput) {
        container.querySelectorAll('.ai-card').forEach(card => {
            const skillId = card.querySelector('.ai-skill').value;
            cardsData.push({
                cond: card.querySelector('.ai-cond').value,
                skill: skillId,
                prob: Number(card.querySelector('.ai-prob').value) || 100
            });
            if (skillId && skillId !== "normal" && skillId !== "nothing" && skillId !== "sys_event_jump") {
                usedSkills.add(skillId);
            }
        });
        hiddenInput.value = JSON.stringify(cardsData);
    }

    // 2. 基本行動の技も抽出する
    const base1 = root.querySelector('.enemy-data[data-key="act_base_skill"]');
    const base2 = root.querySelector('.enemy-data[data-key="act_base_skill2"]');
    if (base1 && base1.value && base1.value !== "normal" && base1.value !== "nothing" && base1.value !== "sys_event_jump") usedSkills.add(base1.value);
    if (base2 && base2.value && base2.value !== "none" && base2.value !== "normal" && base2.value !== "nothing" && base2.value !== "sys_event_jump") usedSkills.add(base2.value);
};

document.addEventListener('change', (e) => {
    const target = e.target;

    // 1. AI行動の更新
    if (target.classList.contains('ai-cond') || target.classList.contains('ai-skill') || target.classList.contains('ai-prob') || 
        target.getAttribute('data-key') === 'act_base_skill' || target.getAttribute('data-key') === 'act_base_skill2') {
        if (typeof updateAiCardsData === 'function') updateAiCardsData(target);
    }

    // 2. ID変更の自動追従（日本語対応・フローチャート即時同期版）
    if (target.classList && (target.classList.contains('scene-id-input') || target.getAttribute('data-key') === 'id')) {
        const oldId = (target.dataset.oldValue || "").trim();
        const newId = target.value.trim();
        
        const reservedWords =["money", "exp", "all", "none", "normal", "nothing", "sys_event_jump"];

        if (oldId && newId && oldId !== newId) {
            
            // システム予約語チェック
            if (reservedWords.includes(newId.toLowerCase())) {
                showToast(`⚠️ エラー：「${newId}」は予約語のため使用できません`, "error");
                target.value = oldId;
                return;
            }

            // 重複チェック
            if (target.classList.contains('scene-id-input')) {
                const existingBlock = document.querySelector(`.scene-block[data-scene-id="${newId}"]`);
                if (existingBlock) {
                    showToast(`⚠️ エラー：シーンID「${newId}」は既に存在します`, "error");
                    target.value = oldId; 
                    return; 
                }
            }

            let updateCount = 0;

            // --- A. シーンID（枠の名前）が変更された場合 ---
            if (target.classList.contains('scene-id-input')) {
                const block = target.closest('.scene-block');
                if (block) {
                    // 🌟 フローチャートが即座に認識できるように属性とIDを即時更新
                    block.setAttribute('data-scene-id', newId);
                    block.id = `scene-block-${newId}`;
                }

                // 全ての「ジャンプ先入力欄」をスキャンして書き換える
                const targetKeys =["win", "lose", "escape", "scout", "next", "c1_next", "c2_next", "c3_next", "c4_next", "opt1_next", "opt2_next", "true_next", "false_next", "failScene", "trueNext", "falseNext", "death_scene", "trigger_scene"];
                document.querySelectorAll(".step-data, .player-data, .enemy-data").forEach(inp => {
                    if (targetKeys.includes(inp.getAttribute("data-key")) && inp.value.trim() === oldId) {
                        inp.value = newId;
                        updateCount++;
                    }
                });
            } 
            // --- B. 敵/アイテム/技のIDが変更された場合（日本語対応版） ---
            else {
                const updateValue = (val) => {
                    if (!val) return val;
                    let parts = val.split(',').map(s => s.trim());
                    let changed = false;
                    let newParts = parts.map(p => {
                        if (p === oldId) { changed = true; return newId; }
                        return p;
                    });
                    if (changed) updateCount++;
                    return newParts.join(', ');
                };

                // 各種データの参照（enemies, skills, items等）を更新
                document.querySelectorAll(".step-data, .player-data, .enemy-data").forEach(inp => {
                    const key = inp.getAttribute("data-key");
                    if (["enemies", "skills", "items", "target", "targetItem", "teaches_skill", "equip", "trigger_id", "recipe", "level_skills"].includes(key)) {
                        inp.value = updateValue(inp.value);
                    }
                });
            }

            if (updateCount > 0) showToast(`🔄 ID変更に伴い、${updateCount}箇所のリンクを自動修正しました！`, "info");
            target.dataset.oldValue = newId;
        }
    }

    // 3. 履歴保存とリスト更新
    const editorView = document.getElementById("view-editor");
    if (editorView && editorView.classList.contains("active")) {
        if (typeof updateDatalists === 'function') updateDatalists();
        if (typeof pushHistory === 'function') pushHistory();
    }
});

// 🌟 フォーカスが当たった時に「変更前の値」を記憶しておく処理
document.addEventListener('focusin', function(e) {
    if (!e.target || !e.target.classList) return;
    if (e.target.classList.contains('scene-id-input') || e.target.getAttribute('data-key') === 'id') {
        e.target.dataset.oldValue = e.target.value;
    }
    if (e.target.classList.contains('skill-input')) {
        e.target.dataset.prevValue = e.target.value;
    }
});
window.appendSkillFromList = function(inputEl) {
    // 🌟 追加：もし input 要素のクラスに "ai-skill" か "enemy-data"（かつ act_base_skill）が含まれていれば、
    // カンマを付け足す処理（追記モード）を行わず、普通に値を上書きして終わる。
    if (inputEl.classList.contains("ai-skill") || 
        inputEl.getAttribute("data-key") === "act_base_skill" || 
        inputEl.getAttribute("data-key") === "act_base_skill2") {
        return; // ブラウザ標準の datalist 補完に任せる
    }

    const val = inputEl.value;
    
    // 入力された文字が、実際に存在する技のID（または名前）と完全に一致するかチェック
    let matchedSkillId = null;
    document.querySelectorAll(".skill-data[data-key='id']").forEach(i => {
        const sid = i.value.trim();
        const nameInput = i.closest('.step-block').querySelector(".skill-data[data-key='name']");
        const sname = nameInput && nameInput.value ? nameInput.value : sid;
        if (val === sid || val === sname) {
            matchedSkillId = sid;
        }
    });

    if (matchedSkillId) {
        const oldVal = inputEl.dataset.prevValue || "";
        
        // 直前の文字が「数字:」で終わっているかチェック（レベルアップ技用）
        // 例: "5:" や "10: " などのパターン
        const levelPrefixMatch = oldVal.match(/(\d+:)\s*$/);
        const levelPrefix = levelPrefixMatch ? levelPrefixMatch[1] : "";

        if (oldVal.trim() === "") {
            inputEl.value = matchedSkillId;
        } else {
            if (levelPrefix) {
                // 「5:」などがあった場合は、その手前までの文字列 ＋ 「5:」 ＋ 「技ID」
                const beforeLevel = oldVal.substring(0, oldVal.lastIndexOf(levelPrefix));
                inputEl.value = beforeLevel + levelPrefix + matchedSkillId;
            } else {
                // 普通の技リストの場合
                const separator = oldVal.match(/,\s*$/) ? "" : ", ";
                inputEl.value = oldVal + separator + matchedSkillId;
            }
        }
        // 連続入力しやすくするため、末尾にカンマを添えて記憶
        inputEl.dataset.prevValue = inputEl.value + ", ";
    } else {
        // 手入力中はそのまま記憶
        inputEl.dataset.prevValue = val;
    }
};

// 🌟 追加：エディタ終了時の確認ダイアログ
window.confirmReturnToTitle = function() {
    if (confirm("エディタを終了してタイトル画面に戻りますか？\n（※保存していない編集内容は失われます）")) {
        // すべてのデータをクリーンアップしてから戻る
        if (typeof cleanupGameState === 'function') cleanupGameState();
        changeView("view-title");
    }
};

// 🌟 追加：AIで使われていない技を整理する関数
window.cleanupEnemySkills = function(btn) {
    const root = btn.closest('.step-block');
    if (!root) return;
    
    let usedSkills = new Set();
    const container = root.querySelector('.ai-cards-container');
    if (container) {
        container.querySelectorAll('.ai-card').forEach(card => {
            const skillId = card.querySelector('.ai-skill').value;
            if (skillId && skillId !== "normal" && skillId !== "nothing" && skillId !== "sys_event_jump") usedSkills.add(skillId);
        });
    }
    const base1 = root.querySelector('.enemy-data[data-key="act_base_skill"]');
    const base2 = root.querySelector('.enemy-data[data-key="act_base_skill2"]');
    if (base1 && base1.value && base1.value !== "normal" && base1.value !== "nothing" && base1.value !== "sys_event_jump") usedSkills.add(base1.value);
    if (base2 && base2.value && base2.value !== "none" && base2.value !== "normal" && base2.value !== "nothing" && base2.value !== "sys_event_jump") usedSkills.add(base2.value);

    const skillsInput = root.querySelector('.enemy-data[data-key="skills"]');
    if (skillsInput) {
        skillsInput.value = Array.from(usedSkills).join(', ');
        showToast("🧹 使われていない技を整理しました！", "success");
        if (typeof updateDatalists === 'function') updateDatalists();
        if (typeof pushHistory === 'function') pushHistory();
    }
};
