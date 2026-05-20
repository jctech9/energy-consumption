(function () {
  "use strict";

  const STORAGE_KEY = "energy-consumption.records.v1";
  const SETTINGS_KEY = "energy-consumption.settings.v1";
  const FIRESTORE_COLLECTION = "energyConsumption";
  const FIRESTORE_DOC_ID = "default";

  const DEFAULT_SETTINGS = {
    tariff: 0.83,
    billingDays: 24
  };

  const MODES = {
    alwaysOn: "24h ligado",
    hoursPerDay: "Horas por dia",
    perHour: "Por hora",
    perUse: "Por uso",
    period: "Periodo medido"
  };

  const state = {
    records: loadRecords(),
    settings: loadSettings(),
    remoteStore: null,
    remoteDoc: null,
    remoteUnsubscribe: null,
    remoteReady: false,
    currentUser: null,
    selectedId: null,
    filters: {
      search: "",
      mode: "all"
    }
  };

  const els = {
    form: document.getElementById("deviceForm"),
    formTitle: document.getElementById("formTitle"),
    newRecordButton: document.getElementById("newRecordButton"),
    deleteButton: document.getElementById("deleteButton"),
    deviceName: document.getElementById("deviceName"),
    measuredTime: document.getElementById("measuredTime"),
    measuredKwh: document.getElementById("measuredKwh"),
    mode: document.getElementById("mode"),
    hoursPerDay: document.getElementById("hoursPerDay"),
    daysPerMonth: document.getElementById("daysPerMonth"),
    usesPerMonth: document.getElementById("usesPerMonth"),
    tariff: document.getElementById("tariff"),
    notes: document.getElementById("notes"),
    calculationPreview: document.getElementById("calculationPreview"),
    defaultTariff: document.getElementById("defaultTariff"),
    defaultDays: document.getElementById("defaultDays"),
    searchInput: document.getElementById("searchInput"),
    modeFilter: document.getElementById("modeFilter"),
    totalCost: document.getElementById("totalCost"),
    totalKwh: document.getElementById("totalKwh"),
    topConsumer: document.getElementById("topConsumer"),
    pendingCount: document.getElementById("pendingCount"),
    recordCount: document.getElementById("recordCount"),
    recordsTable: document.getElementById("recordsTable"),
    insightList: document.getElementById("insightList"),
    chart: document.getElementById("costChart"),
    storageStatus: document.getElementById("storageStatus"),
    appWorkspace: document.getElementById("appWorkspace"),
    authBar: document.getElementById("authBar"),
    authForm: document.getElementById("authForm"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    loginButton: document.getElementById("loginButton"),
    authSession: document.getElementById("authSession"),
    authUser: document.getElementById("authUser"),
    logoutButton: document.getElementById("logoutButton"),
    authMessage: document.getElementById("authMessage"),
    exportCsvButton: document.getElementById("exportCsvButton"),
    exportJsonButton: document.getElementById("exportJsonButton"),
    importButton: document.getElementById("importButton"),
    importFileInput: document.getElementById("importFileInput")
  };

  initialize();

  function initialize() {
    setAccessLocked(true);
    syncSettingsInputs();
    bindEvents();
    resetForm();
    render();
    bootDataStore();
  }

  function bootDataStore() {
    const remote = createRemoteStore();
    if (!remote) {
      updateStorageStatus("Login indisponivel", "error");
      updateAuthMessage("Firebase indisponivel.", "error");
      return;
    }

    state.remoteStore = remote;
    updateAuthUi();

    if (!remote.auth || !remote.auth.onAuthStateChanged || !remote.auth.signInWithEmailAndPassword) {
      updateStorageStatus("Auth indisponivel", "error");
      updateAuthMessage("Autenticacao por email indisponivel.", "error");
      return;
    }

    updateStorageStatus("Login pendente", "warning");
    remote.auth.onAuthStateChanged(function (user) {
      state.currentUser = user || null;
      updateAuthUi();
      if (state.currentUser) {
        connectRemoteData();
        return;
      }
      disconnectRemoteData();
      updateStorageStatus("Login pendente", "warning");
    }, function (error) {
      console.error("Firebase auth failed", error);
      updateStorageStatus("Login indisponivel", "error");
      updateAuthMessage("Falha na autenticacao.", "error");
    });
  }

  function createRemoteStore() {
    const config = window.firebaseConfig;
    const hasConfig = config &&
      config.apiKey &&
      config.projectId &&
      config.apiKey !== "SUA_API_KEY" &&
      config.projectId !== "SEU_PROJETO";

    if (!hasConfig || !window.firebase || !firebase.initializeApp || !firebase.firestore) {
      return null;
    }

    const app = firebase.apps && firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(config);
    const firestore = firebase.firestore(app);
    const auth = firebase.auth ? firebase.auth(app) : null;

    return {
      app: app,
      auth: auth,
      docRef: firestore.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC_ID)
    };
  }

  async function connectRemoteData() {
    const remote = state.remoteStore;
    if (!remote || !state.currentUser) {
      return;
    }

    disconnectRemoteData();
    state.remoteReady = false;
    updateAuthUi();
    state.remoteDoc = remote.docRef;
    updateStorageStatus("Conectando", "warning");

    try {
      const snapshot = await state.remoteDoc.get();
      if (snapshot.exists) {
        applyRemoteData(snapshot.data());
        await writeRemoteData();
      } else {
        await writeRemoteData();
      }

      state.remoteUnsubscribe = state.remoteDoc.onSnapshot(function (nextSnapshot) {
        if (nextSnapshot.exists) {
          applyRemoteData(nextSnapshot.data());
        }
        updateStorageStatus("Firebase", "");
        updateAuthMessage("", "");
      }, function (error) {
        console.error("Firestore listener failed", error);
        state.remoteReady = false;
        updateAuthUi();
        updateStorageStatus("Firebase erro", "error");
        updateAuthMessage(firestoreErrorMessage(error), "error");
      });

      state.remoteReady = true;
      updateAuthUi();
      updateStorageStatus("Firebase", "");
      updateAuthMessage("", "");
    } catch (error) {
      console.error("Firebase connection failed", error);
      disconnectRemoteData();
      updateStorageStatus("Firebase erro", "error");
      updateAuthMessage(firestoreErrorMessage(error), "error");
    }
  }

  function disconnectRemoteData() {
    if (state.remoteUnsubscribe) {
      state.remoteUnsubscribe();
      state.remoteUnsubscribe = null;
    }
    state.remoteDoc = null;
    state.remoteReady = false;
  }

  function applyRemoteData(data) {
    if (Array.isArray(data.records)) {
      state.records = data.records.map(normalizeRecord);
    }
    state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    cacheLocalData();
    syncSettingsInputs();
    render();
    updatePreview();
  }

  function syncSettingsInputs() {
    els.defaultTariff.value = formatInputNumber(state.settings.tariff);
    els.defaultDays.value = formatInputNumber(state.settings.billingDays);
  }

  function updateStorageStatus(text, tone) {
    if (!els.storageStatus) {
      return;
    }
    els.storageStatus.textContent = text;
    els.storageStatus.classList.toggle("warning", tone === "warning");
    els.storageStatus.classList.toggle("error", tone === "error");
  }

  function bindEvents() {
    if (els.authForm) {
      els.authForm.addEventListener("submit", handleLogin);
    }
    if (els.logoutButton) {
      els.logoutButton.addEventListener("click", handleLogout);
    }

    els.form.addEventListener("submit", handleSubmit);
    els.newRecordButton.addEventListener("click", resetForm);
    els.deleteButton.addEventListener("click", deleteSelected);
    els.mode.addEventListener("change", function () {
      updateModeFields();
      updatePreview();
    });

    [
      els.measuredTime,
      els.measuredKwh,
      els.hoursPerDay,
      els.daysPerMonth,
      els.usesPerMonth,
      els.tariff
    ].forEach(function (input) {
      input.addEventListener("input", updatePreview);
    });

    els.defaultTariff.addEventListener("change", updateSettings);
    els.defaultDays.addEventListener("change", updateSettings);

    els.searchInput.addEventListener("input", function () {
      state.filters.search = els.searchInput.value.trim().toLowerCase();
      render();
    });

    els.modeFilter.addEventListener("change", function () {
      state.filters.mode = els.modeFilter.value;
      render();
    });

    els.recordsTable.addEventListener("click", handleTableAction);
    els.exportCsvButton.addEventListener("click", exportCsv);
    els.exportJsonButton.addEventListener("click", exportJson);
    els.importButton.addEventListener("click", function () {
      els.importFileInput.click();
    });
    els.importFileInput.addEventListener("change", importJson);

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(drawChart);
      observer.observe(els.chart);
    } else {
      window.addEventListener("resize", drawChart);
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    const remote = state.remoteStore;
    if (!remote || !remote.auth) {
      updateAuthMessage("Firebase indisponivel.", "error");
      return;
    }

    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    if (!email || !password) {
      return;
    }

    updateAuthMessage("Entrando...", "");
    updateStorageStatus("Conectando", "warning");
    els.loginButton.disabled = true;
    remote.auth.signInWithEmailAndPassword(email, password)
      .then(function () {
        els.authPassword.value = "";
        updateAuthMessage("", "");
      })
      .catch(function (error) {
        console.error("Firebase login failed", error);
        updateStorageStatus("Login falhou", "error");
        updateAuthMessage(authErrorMessage(error), "error");
      })
      .finally(function () {
        els.loginButton.disabled = false;
      });
  }

  function handleLogout() {
    const remote = state.remoteStore;
    if (!remote || !remote.auth) {
      return;
    }
    remote.auth.signOut().catch(function (error) {
      console.error("Firebase logout failed", error);
      updateAuthMessage("Nao foi possivel sair.", "error");
    });
  }

  function updateAuthUi() {
    if (!els.authForm || !els.authSession || !els.authUser) {
      return;
    }

    const user = state.currentUser;
    els.authForm.hidden = Boolean(user);
    els.authSession.hidden = !user;
    els.authUser.textContent = user ? (user.email || user.uid) : "";
    setAccessLocked(!user || !state.remoteReady);

    if (user) {
      updateAuthMessage("", "");
    }
  }

  function updateAuthMessage(text, tone) {
    if (!els.authMessage) {
      return;
    }
    els.authMessage.textContent = text;
    els.authMessage.classList.toggle("error", tone === "error");
  }

  function authErrorMessage(error) {
    const code = error && error.code;
    if (code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials") {
      return "Email ou senha invalidos.";
    }
    if (code === "auth/too-many-requests") {
      return "Muitas tentativas. Tente novamente depois.";
    }
    if (code === "auth/network-request-failed") {
      return "Falha de rede ao entrar.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Ative Email/Password em Authentication.";
    }
    if (code === "auth/invalid-email") {
      return "Email invalido.";
    }
    if (code === "auth/user-disabled") {
      return "Usuario desativado no Firebase.";
    }
    return "Nao foi possivel entrar.";
  }

  function firestoreErrorMessage(error) {
    const code = error && error.code;
    if (code === "permission-denied") {
      return "Sem permissao no Firestore. Confira as regras publicadas.";
    }
    if (code === "unavailable") {
      return "Firestore indisponivel ou sem rede.";
    }
    if (code === "not-found") {
      return "Firestore nao encontrado neste projeto.";
    }
    return "Login feito, mas nao foi possivel conectar ao Firestore.";
  }

  function setAccessLocked(locked) {
    if (els.appWorkspace) {
      els.appWorkspace.hidden = locked;
    }
    [
      els.importButton,
      els.exportJsonButton,
      els.exportCsvButton
    ].forEach(function (button) {
      if (button) {
        button.hidden = locked;
      }
    });
  }

  function loadRecords() {
    const saved = readJson(STORAGE_KEY);
    if (Array.isArray(saved)) {
      return saved.map(normalizeRecord);
    }
    return [];
  }

  function loadSettings() {
    const saved = readJson(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_SETTINGS, saved || {});
  }

  function readJson(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn("Storage read failed", error);
      return null;
    }
  }

  function persist() {
    if (!state.currentUser) {
      updateStorageStatus("Login pendente", "warning");
      updateAuthMessage("Entre para usar o sistema.", "error");
      return Promise.resolve();
    }
    if (!state.remoteDoc || !state.remoteReady) {
      updateStorageStatus("Conectando", "warning");
      updateAuthMessage("Aguarde a conexao com o Firestore.", "error");
      return Promise.resolve();
    }

    cacheLocalData();
    updateStorageStatus("Salvando", "warning");
    return writeRemoteData()
      .then(function () {
        updateStorageStatus("Firebase", "");
      })
      .catch(function (error) {
        console.error("Firestore write failed", error);
        updateStorageStatus("Firebase erro", "error");
      });
  }

  function cacheLocalData() {
    try {
      state.records = state.records.map(normalizeRecord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (error) {
      console.warn("Local cache write failed", error);
    }
  }

  function writeRemoteData() {
    if (!state.remoteDoc) {
      return Promise.resolve();
    }
    return state.remoteDoc.set({
      schemaVersion: 1,
      settings: sanitizeForFirestore(state.settings),
      records: sanitizeForFirestore(state.records.map(normalizeRecord)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const record = recordFromForm();
    if (!record.device || !isFiniteNumber(record.measuredKwh)) {
      return;
    }

    if (state.selectedId) {
      const index = state.records.findIndex(function (item) {
        return item.id === state.selectedId;
      });
      if (index >= 0) {
        state.records[index] = Object.assign({}, state.records[index], record, {
          id: state.selectedId
        });
      }
    } else {
      state.records.unshift(Object.assign({}, record, {
        id: createId()
      }));
    }

    persist();
    render();
    resetForm();
  }

  function recordFromForm() {
    return {
      device: els.deviceName.value.trim(),
      measuredTime: els.measuredTime.value.trim(),
      measuredKwh: parseNumber(els.measuredKwh.value),
      mode: els.mode.value,
      hoursPerDay: parseOptionalNumber(els.hoursPerDay.value),
      daysPerMonth: parseOptionalNumber(els.daysPerMonth.value),
      usesPerMonth: parseOptionalNumber(els.usesPerMonth.value),
      tariff: parseOptionalNumber(els.tariff.value),
      notes: els.notes.value.trim()
    };
  }

  function normalizeRecord(record) {
    const input = record || {};
    const mode = MODES[input.mode] ? input.mode : "alwaysOn";
    return {
      id: input.id || createId(),
      device: String(input.device || "").trim(),
      measuredTime: String(input.measuredTime || "").trim(),
      measuredKwh: parseOptionalNumber(input.measuredKwh),
      mode: mode,
      hoursPerDay: parseOptionalNumber(input.hoursPerDay),
      daysPerMonth: parseOptionalNumber(input.daysPerMonth),
      usesPerMonth: parseOptionalNumber(input.usesPerMonth),
      tariff: parseOptionalNumber(input.tariff),
      notes: String(input.notes || "").trim()
    };
  }

  function fillForm(record) {
    state.selectedId = record.id;
    els.formTitle.textContent = "Editar aparelho";
    els.deleteButton.hidden = false;
    els.deviceName.value = record.device || "";
    els.measuredTime.value = record.measuredTime || "";
    els.measuredKwh.value = formatInputNumber(record.measuredKwh);
    els.mode.value = record.mode || "alwaysOn";
    els.hoursPerDay.value = formatInputNumber(record.hoursPerDay);
    els.daysPerMonth.value = formatInputNumber(record.daysPerMonth);
    els.usesPerMonth.value = formatInputNumber(record.usesPerMonth);
    els.tariff.value = formatInputNumber(record.tariff);
    els.notes.value = record.notes || "";
    updateModeFields();
    updatePreview();
    els.deviceName.focus();
  }

  function resetForm() {
    state.selectedId = null;
    els.form.reset();
    els.formTitle.textContent = "Novo aparelho";
    els.deleteButton.hidden = true;
    els.mode.value = "alwaysOn";
    els.daysPerMonth.value = "";
    els.tariff.value = "";
    updateModeFields();
    updatePreview();
  }

  function deleteSelected() {
    if (!state.selectedId) {
      return;
    }
    const record = state.records.find(function (item) {
      return item.id === state.selectedId;
    });
    if (!record || !confirm("Excluir este aparelho?")) {
      return;
    }
    state.records = state.records.filter(function (item) {
      return item.id !== state.selectedId;
    });
    persist();
    resetForm();
    render();
  }

  function updateSettings() {
    const tariff = parseNumber(els.defaultTariff.value);
    const days = parseNumber(els.defaultDays.value);
    state.settings.tariff = tariff > 0 ? tariff : DEFAULT_SETTINGS.tariff;
    state.settings.billingDays = days > 0 ? days : DEFAULT_SETTINGS.billingDays;
    els.defaultTariff.value = formatInputNumber(state.settings.tariff);
    els.defaultDays.value = formatInputNumber(state.settings.billingDays);
    persist();
    render();
    updatePreview();
  }

  function updateModeFields() {
    const mode = els.mode.value;
    const needsHours = mode === "hoursPerDay" || mode === "perHour";
    const needsDays = mode === "alwaysOn" || mode === "hoursPerDay" || mode === "perHour";
    const needsUses = mode === "perUse";

    els.hoursPerDay.disabled = !needsHours;
    els.daysPerMonth.disabled = !needsDays;
    els.usesPerMonth.disabled = !needsUses;

    if (!needsHours) {
      els.hoursPerDay.value = "";
    }
    if (!needsDays) {
      els.daysPerMonth.value = "";
    }
    if (!needsUses) {
      els.usesPerMonth.value = "";
    }
  }

  function updatePreview() {
    const calc = calculate(recordFromForm());
    const blocks = els.calculationPreview.querySelectorAll("strong");
    blocks[0].textContent = formatCurrency(calc.monthlyCost);
    blocks[1].textContent = formatNumber(calc.monthlyKwh) + " kWh";
  }

  function render() {
    const enriched = getFilteredRecords().map(enrichRecord);
    renderMetrics(enriched);
    renderInsights(enriched);
    renderTable(enriched);
    drawChart();
  }

  function getFilteredRecords() {
    return state.records.filter(function (record) {
      const modeOk = state.filters.mode === "all" || record.mode === state.filters.mode;
      const haystack = [record.device, record.notes].join(" ").toLowerCase();
      const searchOk = !state.filters.search || haystack.includes(state.filters.search);
      return modeOk && searchOk;
    });
  }

  function enrichRecord(record) {
    return {
      record: record,
      calc: calculate(record)
    };
  }

  function renderMetrics(enriched) {
    const valid = enriched.filter(function (item) {
      return item.calc.isValid;
    });
    const totalCost = valid.reduce(function (sum, item) {
      return sum + item.calc.monthlyCost;
    }, 0);
    const totalKwh = valid.reduce(function (sum, item) {
      return sum + item.calc.monthlyKwh;
    }, 0);
    const top = valid.slice().sort(function (a, b) {
      return b.calc.monthlyCost - a.calc.monthlyCost;
    })[0];
    const pending = enriched.filter(function (item) {
      return !item.calc.isValid;
    }).length;

    els.totalCost.textContent = formatCurrency(totalCost);
    els.totalKwh.textContent = formatNumber(totalKwh) + " kWh";
    els.topConsumer.textContent = top ? top.record.device : "-";
    els.pendingCount.textContent = String(pending);
    els.recordCount.textContent = pluralize(enriched.length, "item", "itens");
  }

  function renderInsights(enriched) {
    const sorted = enriched.slice().sort(function (a, b) {
      return b.calc.monthlyCost - a.calc.monthlyCost;
    });
    const pending = sorted.filter(function (item) {
      return !item.calc.isValid;
    });
    const top = sorted.find(function (item) {
      return item.calc.isValid;
    });
    const periodRows = sorted.filter(function (item) {
      return item.record.mode === "period" && item.calc.isValid;
    });
    const html = [];

    if (top) {
      html.push(insightHtml(
        "Maior custo",
        top.record.device + " representa " + formatCurrency(top.calc.monthlyCost) + " no mes.",
        ""
      ));
    }

    if (pending.length) {
      html.push(insightHtml(
        "Medicoes pendentes",
        pluralize(pending.length, "registro precisa", "registros precisam") + " de tempo medido ou kWh.",
        "warn"
      ));
    }

    if (periodRows.length) {
      html.push(insightHtml(
        "Periodo medido",
        "Registros de periodo medido mantem o custo do periodo sem normalizar para 24h.",
        ""
      ));
    }

    if (!html.length) {
      html.push(insightHtml("Sem alertas", "Os registros filtrados tem dados suficientes para calculo.", ""));
    }

    els.insightList.innerHTML = html.join("");
  }

  function insightHtml(title, text, tone) {
    return [
      '<div class="insight ',
      escapeHtml(tone),
      '"><strong>',
      escapeHtml(title),
      '</strong><span>',
      escapeHtml(text),
      "</span></div>"
    ].join("");
  }

  function renderTable(enriched) {
    const sorted = enriched.slice().sort(function (a, b) {
      return b.calc.monthlyCost - a.calc.monthlyCost;
    });

    if (!sorted.length) {
      els.recordsTable.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum registro encontrado.</td></tr>';
      return;
    }

    els.recordsTable.innerHTML = sorted.map(function (item) {
      const record = item.record;
      const calc = item.calc;
      const measured = [
        record.measuredTime ? escapeHtml(record.measuredTime) : "-",
        isFiniteNumber(record.measuredKwh) ? formatNumber(record.measuredKwh) + " kWh" : "-"
      ].join("<br>");
      return [
        '<tr data-id="',
        escapeHtml(record.id),
        '"><td class="device-cell"><strong>',
        escapeHtml(record.device || "-"),
        '</strong><span>',
        escapeHtml(record.notes || ""),
        '</span></td><td><span class="mode-badge">',
        escapeHtml(MODES[record.mode] || record.mode),
        "</span></td><td>",
        measured,
        '</td><td>',
        calc.isValid ? formatNumber(calc.monthlyKwh) : "-",
        '</td><td><strong>',
        calc.isValid ? formatCurrency(calc.monthlyCost) : "-",
        '</strong><br><span class="muted">',
        calc.unitLabel,
        '</span></td><td><div class="table-actions"><button class="small-button" data-action="edit" data-id="',
        escapeHtml(record.id),
        '" type="button">Editar</button><button class="small-button" data-action="copy" data-id="',
        escapeHtml(record.id),
        '" type="button">Copiar</button></div></td></tr>'
      ].join("");
    }).join("");
  }

  function handleTableAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const record = state.records.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (!record) {
      return;
    }

    if (button.dataset.action === "edit") {
      fillForm(record);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (button.dataset.action === "copy") {
      const copy = Object.assign({}, record, {
        id: createId(),
        device: record.device + " copia"
      });
      state.records.unshift(copy);
      persist();
      render();
    }
  }

  function drawChart() {
    const canvas = els.chart;
    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(260, Math.floor(rect.height));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const records = getFilteredRecords().map(enrichRecord)
      .filter(function (item) {
        return item.calc.isValid && item.calc.monthlyCost > 0;
      })
      .sort(function (a, b) {
        return b.calc.monthlyCost - a.calc.monthlyCost;
      })
      .slice(0, 8);

    context.fillStyle = "#fbfcfb";
    context.fillRect(0, 0, width, height);

    if (!records.length) {
      context.fillStyle = "#5f6b63";
      context.font = "700 15px system-ui";
      context.textAlign = "center";
      context.fillText("Sem dados para o grafico", width / 2, height / 2);
      return;
    }

    const padding = { top: 20, right: 26, bottom: 38, left: 126 };
    const plotWidth = width - padding.left - padding.right;
    const rowHeight = (height - padding.top - padding.bottom) / records.length;
    const max = Math.max.apply(null, records.map(function (item) {
      return item.calc.monthlyCost;
    }));
    const colors = ["#197c73", "#356f9f", "#bf7a16", "#5f7663", "#9a6b46", "#6f6f96", "#75813a", "#b84b4b"];

    context.strokeStyle = "#d8ded7";
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const x = padding.left + (plotWidth * i / 4);
      context.beginPath();
      context.moveTo(x, padding.top);
      context.lineTo(x, height - padding.bottom + 4);
      context.stroke();
    }

    records.forEach(function (item, index) {
      const y = padding.top + index * rowHeight + rowHeight * 0.22;
      const barHeight = Math.max(16, rowHeight * 0.46);
      const barWidth = Math.max(3, plotWidth * (item.calc.monthlyCost / max));

      context.fillStyle = "#17211b";
      context.font = "700 12px system-ui";
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(trimText(context, item.record.device, padding.left - 18), padding.left - 10, y + barHeight / 2);

      context.fillStyle = colors[index % colors.length];
      roundRect(context, padding.left, y, barWidth, barHeight, 4);
      context.fill();

      context.fillStyle = "#17211b";
      context.textAlign = "left";
      context.fillText(formatCurrency(item.calc.monthlyCost), padding.left + barWidth + 8, y + barHeight / 2);
    });

    context.fillStyle = "#5f6b63";
    context.font = "700 11px system-ui";
    context.textAlign = "right";
    context.fillText("R$/mes", width - padding.right, height - 12);
  }

  function calculate(record) {
    const measuredKwh = parseNumber(record.measuredKwh);
    const measuredHours = parseDurationToHours(record.measuredTime);
    const tariff = parseOptionalNumber(record.tariff) || state.settings.tariff;
    const days = parseOptionalNumber(record.daysPerMonth) || state.settings.billingDays;
    const hoursPerDay = parseOptionalNumber(record.hoursPerDay);
    const usesPerMonth = parseOptionalNumber(record.usesPerMonth) || 1;
    const mode = record.mode || "alwaysOn";
    const hasKwh = isFiniteNumber(measuredKwh) && measuredKwh > 0;
    const hasTime = measuredHours > 0;
    const kwhPerHour = hasKwh && hasTime ? measuredKwh / measuredHours : 0;
    const periodCost = hasKwh ? measuredKwh * tariff : 0;
    let monthlyKwh = 0;
    let unitLabel = "";
    let isValid = hasKwh;

    if (mode === "alwaysOn") {
      isValid = hasKwh && hasTime;
      monthlyKwh = isValid ? kwhPerHour * 24 * days : 0;
      unitLabel = isValid ? formatNumber(kwhPerHour * 24) + " kWh/dia" : "tempo pendente";
    }

    if (mode === "hoursPerDay") {
      isValid = hasKwh && hasTime && hoursPerDay > 0;
      monthlyKwh = isValid ? kwhPerHour * hoursPerDay * days : 0;
      unitLabel = isValid ? formatNumber(kwhPerHour) + " kWh/h" : "horas por dia pendente";
    }

    if (mode === "perHour") {
      isValid = hasKwh && hasTime;
      monthlyKwh = isValid ? kwhPerHour * (hoursPerDay || 1) * days : 0;
      unitLabel = isValid ? formatCurrency(kwhPerHour * tariff) + "/h" : "tempo pendente";
    }

    if (mode === "perUse") {
      isValid = hasKwh;
      monthlyKwh = isValid ? measuredKwh * usesPerMonth : 0;
      unitLabel = isValid ? formatCurrency(periodCost) + "/uso" : "kWh pendente";
    }

    if (mode === "period") {
      isValid = hasKwh;
      monthlyKwh = isValid ? measuredKwh : 0;
      unitLabel = hasTime ? "periodo de " + formatNumber(measuredHours / 24) + " dias" : "periodo medido";
    }

    const monthlyCost = monthlyKwh * tariff;
    return {
      measuredKwh: measuredKwh,
      measuredHours: measuredHours,
      kwhPerHour: kwhPerHour,
      monthlyKwh: monthlyKwh,
      monthlyCost: monthlyCost,
      periodCost: periodCost,
      tariff: tariff,
      days: days,
      isValid: isValid,
      unitLabel: unitLabel
    };
  }

  function parseDurationToHours(value) {
    if (!value) {
      return 0;
    }

    let text = String(value).trim().toLowerCase();
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    text = text.replace(/,/g, ".");
    let remaining = text;
    let total = 0;

    remaining = remaining.replace(/(\d+(?:\.\d+)?)\s*(?:d|dia|dias)\b/g, function (_, number) {
      total += parseFloat(number) * 24;
      return " ";
    });

    remaining = remaining.replace(/(\d+(?:\.\d+)?)\s*h(?:oras?)?(?:\s*[: ]\s*(\d+(?:\.\d+)?))?/g, function (_, hours, minutes) {
      total += parseFloat(hours);
      if (minutes) {
        total += parseFloat(minutes) / 60;
      }
      return " ";
    });

    remaining = remaining.replace(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes|minuto|minutos)\b/g, function (_, minutes) {
      total += parseFloat(minutes) / 60;
      return " ";
    });

    remaining = remaining.replace(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seg|segundo|segundos)\b/g, function (_, seconds) {
      total += parseFloat(seconds) / 3600;
      return " ";
    });

    remaining.replace(/\b(\d{1,2})\s*:\s*(\d{2})\b/g, function (_, hours, minutes) {
      total += parseFloat(hours) + parseFloat(minutes) / 60;
      return " ";
    });

    if (total > 0) {
      return total;
    }

    const numeric = parseNumber(text);
    return isFiniteNumber(numeric) ? numeric : 0;
  }

  function parseNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : NaN;
    }
    if (value === null || value === undefined) {
      return NaN;
    }
    const normalized = String(value)
      .trim()
      .replace(/\s+/g, "")
      .replace(/[R$]/g, "")
      .replace(",", ".");
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function parseOptionalNumber(value) {
    const number = parseNumber(value);
    return isFiniteNumber(number) ? number : null;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function formatCurrency(value) {
    const safe = isFiniteNumber(value) ? value : 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(safe);
  }

  function formatNumber(value) {
    const safe = isFiniteNumber(value) ? value : 0;
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safe);
  }

  function formatInputNumber(value) {
    if (!isFiniteNumber(value)) {
      return "";
    }
    return String(value).replace(".", ",");
  }

  function pluralize(count, singular, plural) {
    return count + " " + (count === 1 ? singular : plural);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sanitizeForFirestore(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "record-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function exportCsv() {
    const headers = [
      "aparelho",
      "modo",
      "tempo_medido",
      "kwh_medido",
      "kwh_mes",
      "custo_mes",
      "observacao"
    ];
    const rows = state.records.map(function (record) {
      const calc = calculate(record);
      return [
        record.device,
        MODES[record.mode] || record.mode,
        record.measuredTime,
        record.measuredKwh,
        calc.monthlyKwh,
        calc.monthlyCost,
        record.notes
      ];
    });
    const csv = [headers].concat(rows)
      .map(function (row) {
        return row.map(csvCell).join(";");
      })
      .join("\n");
    downloadFile("consumo-energia.csv", csv, "text/csv;charset=utf-8");
  }

  function exportJson() {
    const payload = {
      settings: state.settings,
      records: state.records
    };
    downloadFile("consumo-energia.json", JSON.stringify(payload, null, 2), "application/json");
  }

  function importJson(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        const records = Array.isArray(payload) ? payload : payload.records;
        if (!Array.isArray(records)) {
          throw new Error("Formato invalido");
        }
        state.records = records.map(normalizeRecord);
        if (payload.settings) {
          state.settings = Object.assign({}, DEFAULT_SETTINGS, payload.settings);
        }
        syncSettingsInputs();
        persist();
        resetForm();
        render();
      } catch (error) {
        alert("Nao foi possivel importar o arquivo JSON.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function csvCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function trimText(context, text, maxWidth) {
    const value = String(text || "");
    if (context.measureText(value).width <= maxWidth) {
      return value;
    }
    let output = value;
    while (output.length > 3 && context.measureText(output + "...").width > maxWidth) {
      output = output.slice(0, -1);
    }
    return output + "...";
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }
})();
