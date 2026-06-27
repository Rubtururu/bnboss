// ═══════════════════════════════════════════════════════════════════════════
//  SOLBOSS – MetaMask + BSC Integration
//  Red: Binance Smart Chain (BNB Chain)
//  Archivo: solboss_metamask.js
//  Añadir al HTML antes de </body>:
//    <script src="solboss_metamask.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

// ── Configuración ─────────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // ← Poner tu dirección aquí tras deploy
const BSC_TESTNET_CHAIN_ID  = "0x61";   // 97  - para pruebas GRATIS
const BSC_MAINNET_CHAIN_ID  = "0x38";   // 56  - red real con BNB
const USE_TESTNET = true; // ← cambiar a false para mainnet con BNB real

const CHAIN_ID = USE_TESTNET ? BSC_TESTNET_CHAIN_ID : BSC_MAINNET_CHAIN_ID;

const BSC_TESTNET_PARAMS = {
    chainId: BSC_TESTNET_CHAIN_ID,
    chainName: "BSC Testnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
    blockExplorerUrls: ["https://testnet.bscscan.com/"]
};

const BSC_MAINNET_PARAMS = {
    chainId: BSC_MAINNET_CHAIN_ID,
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org/"],
    blockExplorerUrls: ["https://bscscan.com/"]
};

// ABI del contrato (solo las funciones que usamos)
const CONTRACT_ABI = [
    {"inputs":[],"name":"registerPlayer","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"damage","type":"uint256"},{"name":"powered","type":"bool"}],"name":"attackBoss","outputs":[],"stateMutability":"payable","type":"function"},
    {"inputs":[],"name":"completeBossSession","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"count","type":"uint8"}],"name":"openBossChest","outputs":[],"stateMutability":"payable","type":"function"},
    {"inputs":[{"name":"itemType","type":"uint8"}],"name":"shopBuy","outputs":[],"stateMutability":"payable","type":"function"},
    {"inputs":[{"name":"world","type":"uint32"},{"name":"stage","type":"uint8"},{"name":"kills","type":"uint64"},{"name":"goldLv","type":"uint8"},{"name":"heroLv","type":"uint8[4]"}],"name":"syncAdventure","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"ascend","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"claimDailyChest","outputs":[],"stateMutability":"nonpayable","type":"function"},
    // Views
    {"inputs":[{"name":"addr","type":"address"}],"name":"getPlayer","outputs":[{"components":[{"name":"sessionId","type":"uint256"},{"name":"damageThisSession","type":"uint256"},{"name":"pendingReward","type":"uint256"},{"name":"wins","type":"uint32"},{"name":"bossLvReached","type":"uint8"},{"name":"advWorld","type":"uint32"},{"name":"advStage","type":"uint8"},{"name":"advKills","type":"uint64"},{"name":"goldLv","type":"uint8"},{"name":"heroLv","type":"uint8[4]"},{"name":"gems","type":"uint32"},{"name":"chestsOpened","type":"uint32"},{"name":"pityEpic","type":"uint16"},{"name":"pityLeg","type":"uint16"},{"name":"pityMyth","type":"uint16"},{"name":"soulFragments","type":"uint32"},{"name":"talentPts","type":"uint8"},{"name":"ascensions","type":"uint8"},{"name":"lastDailyChest","type":"uint256"},{"name":"registered","type":"bool"},{"name":"registeredAt","type":"uint256"}],"type":"tuple"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getSessionInfo","outputs":[{"name":"_sessionId","type":"uint256"},{"name":"_timeLeft","type":"uint256"},{"name":"_poolBoss","type":"uint256"},{"name":"_poolAdventure","type":"uint256"},{"name":"_totalDamage","type":"uint256"}],"stateMutability":"view","type":"function"},
];

// ── Estado global ─────────────────────────────────────────────────────────
let web3, contract, userAccount;
let walletConnected = false;

// ═══════════════════════════════════════════════════════════════════════════
//  CONECTAR METAMASK
// ═══════════════════════════════════════════════════════════════════════════
async function connectMetaMask() {
    const btn = document.getElementById("connectWalletBtn");
    if (btn) btn.textContent = "⏳ Conectando...";

    // 1. Comprobar MetaMask
    if (typeof window.ethereum === "undefined") {
        alert("MetaMask no está instalado.\n\nInstálalo en:\nhttps://metamask.io\n\nY añade la red BSC.");
        if (btn) btn.textContent = "🦊 Instalar MetaMask";
        btn.onclick = () => window.open("https://metamask.io", "_blank");
        return;
    }

    try {
        // 2. Pedir acceso a la cuenta
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAccount = accounts[0];

        // 3. Cambiar a BSC (o añadirla si no existe)
        await switchToBSC();

        // 4. Inicializar web3 + contrato
        web3      = new Web3(window.ethereum);
        contract  = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        walletConnected = true;

        // 5. Actualizar UI
        const short = userAccount.slice(0, 6) + "..." + userAccount.slice(-4);
        if (btn) {
            btn.textContent = "🟢 " + short;
            btn.style.background = "linear-gradient(135deg,#006644,#00cc88)";
            btn.onclick = disconnectWallet;
        }
        document.getElementById("walletStatus") && (document.getElementById("walletStatus").style.display = "block");
        document.getElementById("walletAddr")   && (document.getElementById("walletAddr").textContent = userAccount);

        // 6. Cargar balance y estado del jugador
        await loadWalletBalance();
        await initPlayerOnChain();

        addEv(`<span class="et">🦊 MetaMask conectado: ${short}</span>`);

        // 7. Escuchar cambios de cuenta
        window.ethereum.on("accountsChanged", (accs) => {
            if (accs.length === 0) disconnectWallet();
            else { userAccount = accs[0]; loadWalletBalance(); }
        });

    } catch (e) {
        if (btn) btn.textContent = "🦊 Conectar MetaMask";
        if (btn) btn.onclick = connectMetaMask;
        if (e.code === 4001) addEv('<span class="eg">⚠ Conexión rechazada por el usuario</span>');
        else addEv('<span class="eg">⚠ Error: ' + e.message + '</span>');
    }
}

async function switchToBSC() {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_ID }]
        });
    } catch (e) {
        if (e.code === 4902) {
            // La red no existe en MetaMask → añadirla
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [USE_TESTNET ? BSC_TESTNET_PARAMS : BSC_MAINNET_PARAMS]
            });
        } else throw e;
    }
}

function disconnectWallet() {
    walletConnected = false;
    userAccount = null;
    web3 = contract = null;
    const btn = document.getElementById("connectWalletBtn");
    if (btn) {
        btn.textContent = "🦊 Conectar MetaMask";
        btn.style.background = "";
        btn.onclick = connectMetaMask;
    }
    document.getElementById("walletStatus") && (document.getElementById("walletStatus").style.display = "none");
    document.getElementById("walletHdr") && (document.getElementById("walletHdr").textContent = "0.0000");
    addEv('<span class="eg">🔌 MetaMask desconectado</span>');
}

async function loadWalletBalance() {
    if (!web3 || !userAccount) return;
    try {
        const wei = await web3.eth.getBalance(userAccount);
        const bnb = parseFloat(web3.utils.fromWei(wei, "ether"));
        G.wallet = bnb;
        document.getElementById("walletHdr") && (document.getElementById("walletHdr").textContent = bnb.toFixed(4));
        document.getElementById("walletBalanceLive") && (document.getElementById("walletBalanceLive").textContent = bnb.toFixed(4));
        return bnb;
    } catch (e) { console.warn("loadBalance:", e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
//  INICIALIZAR JUGADOR ON-CHAIN
// ═══════════════════════════════════════════════════════════════════════════
async function initPlayerOnChain() {
    if (!contract || !userAccount) return;
    try {
        const p = await contract.methods.getPlayer(userAccount).call();
        if (!p.registered) {
            addEv('<span class="et">📝 Registrando cuenta en BSC...</span>');
            await contract.methods.registerPlayer().send({ from: userAccount });
            addEv('<span class="et">✅ Cuenta registrada en BSC!</span>');
        } else {
            // Sincronizar estado local con blockchain
            G.gems      = parseInt(p.gems);
            G.pityEpic  = parseInt(p.pityEpic);
            G.pityLeg   = parseInt(p.pityLeg);
            G.pityMyth  = parseInt(p.pityMyth) || 0;
            A.ascensions = parseInt(p.ascensions);
            A.world     = parseInt(p.advWorld) || 1;
            A.stage     = parseInt(p.advStage) || 1;
            updateGemUI();
            updatePityUI();
            addEv('<span class="et">📊 Estado cargado desde BSC</span>');
        }
        // Cargar info de sesión
        await loadSessionInfo();
    } catch(e) { console.warn("initPlayer:", e.message); }
}

async function loadSessionInfo() {
    if (!contract) return;
    try {
        const info = await contract.methods.getSessionInfo().call();
        const poolBnb = parseFloat(web3.utils.fromWei(info._poolBoss, "ether"));
        const advBnb  = parseFloat(web3.utils.fromWei(info._poolAdventure, "ether"));
        G.pool     = poolBnb;
        G.treasury = advBnb;
        document.getElementById("advPoolBig")    && (document.getElementById("advPoolBig").textContent    = poolBnb.toFixed(4));
        document.getElementById("advPayoutBig")  && (document.getElementById("advPayoutBig").textContent  = (advBnb * 0.03).toFixed(4));
        addEv(`<span class="et">Pool Boss: ${poolBnb.toFixed(4)} BNB | Adv: ${advBnb.toFixed(4)} BNB</span>`);
    } catch(e) { console.warn("loadSession:", e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
//  TRANSACCIONES ON-CHAIN
// ═══════════════════════════════════════════════════════════════════════════

// Ataque potenciado (0.001 BNB)
async function txAttackBoss(damage, powered) {
    if (!walletConnected) { doAtk(); return; }
    try {
        const value = powered ? web3.utils.toWei("0.001", "ether") : "0";
        await contract.methods.attackBoss(damage, powered)
            .send({ from: userAccount, value });
        doAtk();
        if (powered) await loadWalletBalance();
    } catch(e) {
        addEv('<span class="eg">⚠ Error ataque: ' + (e.message?.slice(0,50)||e) + '</span>');
        doAtk(); // fallback offline
    }
}

// Abrir cofre boss
async function txOpenChest(count) {
    if (!walletConnected) { openChest(count, "sol"); return; }
    try {
        const value = web3.utils.toWei((0.001 * count).toString(), "ether");
        const tx    = await contract.methods.openBossChest(count)
            .send({ from: userAccount, value });
        addEv(`<span class="eg">✅ Cofre on-chain: ${tx.transactionHash.slice(0,10)}...</span>`);
        openChest(count, "sol");
        await loadWalletBalance();
    } catch(e) {
        addEv('<span class="eg">⚠ ' + (e.message?.slice(0,60)||e) + '</span>');
    }
}

// Reclamar recompensa
async function txClaimReward() {
    if (!walletConnected) { claimReward(); return; }
    try {
        await contract.methods.claimReward().send({ from: userAccount });
        G.pendingReward = 0;
        updateRewardBanner();
        await loadWalletBalance();
        addEv('<span class="eg">💰 ¡Recompensa reclamada en BSC!</span>');
    } catch(e) {
        addEv('<span class="eg">⚠ ' + (e.message?.slice(0,60)||e) + '</span>');
        claimReward();
    }
}

// Compra de tienda
async function txShopBuy(type) {
    if (!walletConnected) { buyShop(type); return; }
    try {
        const costs = { gold: "0.001", gems: "0.01", items: "0.005" };
        const types = { gold: 0, gems: 1, items: 2 };
        const value = web3.utils.toWei(costs[type], "ether");
        await contract.methods.shopBuy(types[type]).send({ from: userAccount, value });
        buyShop(type);
        await loadWalletBalance();
    } catch(e) {
        addEv('<span class="eg">⚠ Tienda: ' + (e.message?.slice(0,50)||e) + '</span>');
    }
}

// Sincronizar aventura
async function txSyncAdventure() {
    if (!walletConnected || !contract) return;
    try {
        await contract.methods.syncAdventure(
            A.world, A.stage,
            A.kills || 0,
            A.goldLv || 1,
            A.heroes.map(h => h.lv || 1)
        ).send({ from: userAccount });
    } catch(e) { console.warn("sync:", e.message); }
}

// Ascensión
async function txAscend() {
    if (!walletConnected) { doAscend(); return; }
    try {
        await contract.methods.ascend().send({ from: userAccount });
        doAscend();
        addEv('<span class="esoul">✦ Ascensión en BSC registrada!</span>');
    } catch(e) {
        console.warn("ascend:", e.message);
        doAscend();
    }
}

// Cofre diario
async function txDailyChest() {
    if (!walletConnected) { openDailyChest(); return; }
    try {
        await contract.methods.claimDailyChest().send({ from: userAccount });
        openDailyChest();
    } catch(e) {
        if (e.message?.includes("Ya reclamaste")) {
            addEv('<span class="eg">⏰ Cofre diario ya reclamado. Espera 24h.</span>');
        } else {
            openDailyChest();
        }
    }
}

// ── Auto-sync cada 60 segundos ────────────────────────────────────────────
setInterval(() => {
    if (walletConnected && A.active) txSyncAdventure();
    if (walletConnected) loadWalletBalance();
}, 60000);

// ── Función principal para el botón del juego ─────────────────────────────
async function connectWalletGame() {
    await connectMetaMask();
}

// ── Exportar ─────────────────────────────────────────────────────────────
window.SolBossWallet = {
    connect:       connectMetaMask,
    disconnect:    disconnectWallet,
    isConnected:   () => walletConnected,
    attackBoss:    txAttackBoss,
    openChest:     txOpenChest,
    claimReward:   txClaimReward,
    shopBuy:       txShopBuy,
    syncAdventure: txSyncAdventure,
    ascend:        txAscend,
    dailyChest:    txDailyChest,
};

console.log("✅ SolBoss BSC SDK cargado. Red:", USE_TESTNET ? "BSC Testnet" : "BSC Mainnet");
