"use strict";
const $ = (id) => document.getElementById(id);
const KEY = { staff: "akt.staff", hist: "akt.hist", set: "akt.set", draft: "akt.draft", expDraft: "akt.expDraft", hozDraft: "akt.hozDraft" };
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
// false — запись не прошла (память заполнена или запрещена): данные живут только до закрытия приложения
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { toast("Не сохранилось на устройстве: после закрытия приложения изменения пропадут. Сделайте Архив → Экспорт.", 8000); return false; }
};
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const ic = (n) => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const num = (s) => parseFloat(String(s).replace(",", "."));

let staff = load(KEY.staff, []);
let hist = load(KEY.hist, []);
const SET_DEF = { manufacturer: "ООО «Вебер Комеханикс»", dept: "Направление сервиса оборудования зубообработки",
  respPos: "", apprPos: "Руководитель направления", apprName: "", dirPos: "Технический директор", dirName: "",
  hozApprPos: "Руководитель службы внутреннего контроля и аудита", hozApprName: "" };
let settings = { ...SET_DEF, ...load(KEY.set, {}) };
// подписанты (утверждает, к оплате) в общем списке с пометкой sign: только в выпадающем списке Ф. И. О., не среди ответственных
// до akt-v15 пометки не было: подписантом считаем того, кто стоит в подписях настроек
function markSigners() {
  const names = [settings.apprName, settings.dirName, settings.hozApprName].map((n) => n.trim()).filter(Boolean);
  staff.forEach((s) => { if (!("sign" in s)) s.sign = names.includes(s.name); });
  save(KEY.staff, staff);
}
markSigners();
const hasEng = () => staff.some((s) => !s.sign);
const engAt = (i) => (staff[i] && !staff[i].sign ? i : staff.findIndex((s) => !s.sign)); // -1, если инженеров нет
let curId = null, engIdx = 0, curExpId = null, respIdx = 0, curHozId = null, hrespIdx = 0;

function toast(t, ms = 3000) {
  const e = $("toast"); e.textContent = t; e.style.display = "block";
  clearTimeout(toast.t); toast.t = setTimeout(() => (e.style.display = "none"), ms);
}

// ---------- вкладки ----------
// экраны: home — выбор документа, act / exp / hoz — документы, staff, arch. Вторая кнопка меню ведёт в открытый документ
const DOCS = { act: { tab: "Акт", title: "Акт о проведении сервисных работ" }, exp: { tab: "Материалы", title: "Отчёт о покупке материалов" },
  hoz: { tab: "Хозрасходы", title: "Отчёт о хозрасходах" } };
const TITLES = { home: "Документы", staff: "Сотрудники", arch: "Архив", act: DOCS.act.title, exp: DOCS.exp.title, hoz: DOCS.hoz.title };
let curDoc = null;
function go(t) {
  if (DOCS[t]) curDoc = t;
  if (t === "home") {
    const a = load(KEY.draft, null), e = load(KEY.expDraft, null), h = load(KEY.hozDraft, null);
    $("hAct").textContent = a && (a.customer || a.machine) ? "Черновик: " + (a.customer || a.machine) : "Новый акт";
    $("hExp").textContent = e && e.goal ? "Черновик: " + e.goal : "Чеки, номера ФД по фото, итог";
    $("hHoz").textContent = h && h.goal?.length ? "Черновик: " + h.goal[0] : "Таблица ФД, суммы, отметка руководителя";
  }
  const dn = $("docBtn");
  dn.classList.toggle("hide", !curDoc);
  if (curDoc) { dn.dataset.t = curDoc; dn.textContent = DOCS[curDoc].tab; }
  document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x.dataset.t === t));
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x.id === t));
  $("actbar").classList.toggle("hide", t !== "act");
  $("expbar").classList.toggle("hide", t !== "exp");
  $("hozbar").classList.toggle("hide", t !== "hoz");
  document.body.classList.toggle("home", t === "home");
  $("ttl").textContent = TITLES[t];
  window.scrollTo(0, 0);
}
document.querySelectorAll("nav button").forEach((b) => b.onclick = () => go(b.dataset.t));
document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => go(b.dataset.go));

// ---------- диктовка ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function addMic(el) {
  const w = el.parentElement;
  if (!SR || !w.classList.contains("m") || w.querySelector(".mic")) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "mic"; b.innerHTML = ic("mic"); b.setAttribute("aria-label", "Надиктовать");
  b.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "ru-RU"; rec.interimResults = false;
    rec.onresult = (e) => {
      const t = [...e.results].map((r) => r[0].transcript).join(" ").trim();
      const multi = el.tagName === "TEXTAREA";
      el.value = el.value ? el.value + (multi && !el.value.endsWith("\n") ? "\n" : " ") + t : t;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    rec.onend = () => { b.classList.remove("rec"); rec = null; };
    rec.onerror = () => toast("Диктовка недоступна. Используйте микрофон на клавиатуре");
    b.classList.add("rec"); rec.start();
  };
  w.appendChild(b);
}
const mics = (root = document) => root.querySelectorAll(".inw.m input,.inw.m textarea").forEach(addMic);

// ---------- элементы формы ----------
function mk(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
function field(label, f, val = "", o = {}) {
  const e = mk(`<div class="fld ${o.cls || ""}"><label></label><div class="inw"><input data-f="${f}" autocomplete="off"></div><p class="err">${o.err || ""}</p></div>`);
  e.querySelector("label").textContent = label;
  const i = e.querySelector("input"); i.value = val; if (o.type) i.type = o.type; if (o.type === "date") i.className = "in";
  return e;
}
function stepper(label, f, val, step, min, err) {
  const e = mk(`<div class="fld"><label></label><div class="step"><button type="button" aria-label="Меньше">${ic("minus")}</button>
    <input data-f="${f}" inputmode="decimal" autocomplete="off"><button type="button" aria-label="Больше">${ic("plus")}</button></div><p class="err">${err || ""}</p></div>`);
  e.querySelector("label").textContent = label;
  const i = e.querySelector("input"); i.value = val ?? "";
  const bump = (d) => {
    const v = num(i.value);
    const n = isNaN(v) ? Math.max(min, d > 0 ? step : min) : Math.max(min, Math.round((v + d * step) * 100) / 100);
    i.value = String(n).replace(".", ","); i.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const [m, p] = e.querySelectorAll("button"); m.onclick = () => bump(-1); p.onclick = () => bump(1);
  return e;
}
function item(children, after = () => { sync(); persist(); }) {
  const it = mk(`<div class="item"></div>`);
  children.forEach((c) => it.appendChild(c));
  const x = mk(`<button type="button" class="btn d del">${ic("trash")}Удалить</button>`);
  x.onclick = () => { it.remove(); after(); };
  it.appendChild(x); return it;
}
function addPart(p = {}) {
  const r = mk(`<div class="irow"></div>`);
  const q = stepper("Кол-во", "qty", p.qty ?? "1", 1, 1); const n = field("Замечания", "note", p.note || "", { cls: "wide" });
  r.append(q, n);
  $("parts").appendChild(item([field("Наименование запчасти", "name", p.name || ""), r]));
}
function addLabor(l = {}) {
  const prev = $("labor").lastElementChild;
  const r = mk(`<div class="irow"></div>`);
  r.append(
    stepper("Проезд, ч", "trip", l.trip ?? "0", 0.5, 0, "Укажите время проезда (0, если не было)"),
    stepper("Работа, ч", "work", l.work ?? "", 0.5, 0, "Укажите часы работы"),
    stepper("Инженеров", "eng", l.eng ?? (prev ? prev.querySelector('[data-f=eng]').value : "1"), 1, 1, "Укажите число инженеров"));
  $("labor").appendChild(item([field("Дата работ", "date", l.date || (prev ? prev.querySelector('[data-f=date]').value : todayISO()), { type: "date", err: "Укажите дату" }), r, field("Замечания", "note", l.note || "")]));
}
$("addPart").onclick = () => { addPart(); persist(); };
$("addLabor").onclick = () => { addLabor(); persist(); };

const fmtShort = (iso) => (iso && iso.length === 10 && iso[4] === "-" ? iso.split("-").reverse().join(".") : iso || "");
const rowsOf = (box) => [...box.children].map((it) => Object.fromEntries([...it.querySelectorAll("[data-f]")].map((i) => [i.dataset.f, i.value.trim()])));

// ---------- сбор / заполнение ----------
const TEXT = ["customer", "address", "machine", "serial", "contract", "request", "works", "remarks", "date"];
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const wval = () => document.querySelector("input[name=w]:checked").value;

function collect() {
  const w = wval(), e = staff[engIdx] || {}, iso = $("date").value;
  const [y, m, dd] = iso ? iso.split("-") : [];
  const parts = rowsOf($("parts")), labor = rowsOf($("labor"));
  return {
    warranty: w,
    customer: $("customer").value.trim(), address: $("address").value.trim(),
    machine: $("machine").value.trim(), serial: $("serial").value.trim(), contract: $("contract").value.trim(),
    request: lines($("request").value), works: lines($("works").value), remarks: lines($("remarks").value),
    parts: $("partsOn").checked ? parts.filter((p) => p.name) : [],
    labor: w === "warranty" ? [] : labor.map((l) => ({ ...l, date: fmtShort(l.date) })),
    manufacturer: settings.manufacturer,
    dateText: iso ? `« ${+dd} » ${MONTHS[m - 1]} ${y} г.` : "",
    engineerName: e.name || "", engineerPos: e.pos || "",
    _iso: iso, _parts: parts, _labor: labor, _eng: engIdx,
    _txt: Object.fromEntries(TEXT.map((k) => [k, $(k).value])),
  };
}

function fill(d) {
  step = 0;
  document.querySelector(`input[name=w][value=${d.warranty || "warranty"}]`).checked = true;
  TEXT.forEach((k) => ($(k).value = d._txt?.[k] ?? ""));
  $("date").value = d._iso || todayISO();
  $("parts").innerHTML = ""; $("labor").innerHTML = "";
  const objs = (a) => (a || []).filter((r) => r && !Array.isArray(r));
  objs(d._parts).forEach(addPart); objs(d._labor).forEach(addLabor);
  $("partsOn").checked = !!objs(d._parts).length;
  engIdx = engAt(d._eng);
  renderStaff(); sync();
}

function sync() {
  const w = wval();
  $("laborCard").classList.toggle("hide", w === "warranty");
  $("partsBox").classList.toggle("hide", !$("partsOn").checked);
  if ($("partsOn").checked && !$("parts").children.length) addPart();
  if (w !== "warranty" && !$("labor").children.length) addLabor();
  refreshSteps();
}
// _pv: просмотр был открыт — мобильный браузер после скачивания файла перезагружает страницу
let pvKind = "act";
const pvOpen = (k) => $("pv").classList.contains("on") && pvKind === k;
function persist() { save(KEY.draft, { ...collect(), _id: curId, _pv: pvOpen("act") }); }
addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
$("act").addEventListener("input", (e) => { e.target.closest(".bad")?.classList.remove("bad"); persist(); });
$("act").addEventListener("change", () => { sync(); persist(); });

// ---------- проверка ----------
function validate(d) {
  document.querySelectorAll("#act .bad").forEach((e) => e.classList.remove("bad"));
  const bad = [];
  const mark = (el, cond) => { if (cond) { const f = el.closest(".fld") || el; f.classList.add("bad"); bad.push(f); } };
  mark($("customer"), !d.customer);
  mark($("machine"), !d.machine);
  mark($("works"), !d.works.length);
  if (d.warranty !== "warranty") {
    [...$("labor").children].forEach((it) => {
      const g = (f) => it.querySelector(`[data-f=${f}]`);
      mark(g("date"), !g("date").value);
      mark(g("trip"), isNaN(num(g("trip").value)));
      mark(g("work"), !(num(g("work").value) > 0));
      mark(g("eng"), !(num(g("eng").value) >= 1));
    });
  }
  if (!hasEng()) mark($("engineer"), true);
  return bad;
}

// ---------- сотрудники ----------
function staffChips(box, name, cur, pick) {
  box.innerHTML = hasEng() ? "" : '<span class="empty">Список пуст</span>';
  staff.forEach((s, i) => {
    if (s.sign) return;
    const c = mk(`<label class="chip"><input type="radio" name="${name}" value="${i}"><span class="dot"></span><span><span class="n"></span><small></small></span></label>`);
    c.querySelector(".n").textContent = s.name; c.querySelector("small").textContent = s.pos;
    const r = c.querySelector("input"); r.checked = i === cur;
    r.onchange = () => pick(i);
    box.appendChild(c);
  });
}
function renderStaff() {
  staffChips($("engineer"), "eng", engIdx, (i) => { engIdx = i; persist(); });
  staffChips($("resp"), "resp", respIdx, (i) => { respIdx = i; persistExp(); });
  staffChips($("hResp"), "hresp", hrespIdx, (i) => { hrespIdx = i; persistHoz(); });
  document.querySelectorAll("[data-pos]").forEach(svBtn);
  $("sList").innerHTML = staff.length ? "" : '<p class="empty">Пока никого. Добавьте инженеров: их можно будет выбрать в акте и отчётах.</p>';
  staff.forEach((s, i) => {
    const r = mk(`<div class="it"><div><b></b><small></small></div></div>`);
    r.querySelector("b").textContent = s.name; r.querySelector("small").textContent = [s.pos, s.sign && "подписант"].filter(Boolean).join(" · ");
    const x = mk(`<button class="btn d">${ic("trash")}</button>`); x.setAttribute("aria-label", `Удалить ${s.name}`);
    x.onclick = () => { if (confirm(`Удалить «${s.name}» из списка сотрудников? Документы в архиве не изменятся.`)) { staff.splice(i, 1); engIdx = respIdx = hrespIdx = engAt(-1); save(KEY.staff, staff); renderStaff(); persist(); persistExp(); persistHoz(); } };
    const t = mk(`<button class="btn"></button>`); t.textContent = s.sign ? "В инженеры" : "В подписанты";
    t.onclick = () => { s.sign = !s.sign; save(KEY.staff, staff); engIdx = engAt(engIdx); respIdx = engAt(respIdx); hrespIdx = engAt(hrespIdx); renderStaff(); persist(); persistExp(); persistHoz(); };
    r.append(t, x); $("sList").appendChild(r);
  });
}
// ошибка под полем, а не всплывающим сообщением: оно исчезает через 3 с, а поле остаётся подсвеченным до исправления
function sNameErr(msg) {
  const i = $("sName"), f = i.closest(".fld");
  f.classList.toggle("bad", !!msg); i.setAttribute("aria-invalid", !!msg); $("sNameErr").textContent = msg || "";
  if (msg) i.focus();
}
$("sName").oninput = () => sNameErr("");
$("sName").onkeydown = (e) => { if (e.key === "Enter") $("sPos").focus(); };
$("sPos").onkeydown = (e) => { if (e.key === "Enter") $("sAdd").click(); };
$("sAdd").onclick = () => {
  const name = $("sName").value.trim(), pos = $("sPos").value.trim() || "сервисный инженер", sign = $("sSign").checked;
  if (!name) return sNameErr("Введите Ф. И. О. так, как оно стоит в подписи, например «Иванов И. И.»");
  // «Иванов И.И.» и «иванов и. и.» — один человек: сравниваем без пробелов, регистра и ё
  const key = (n) => n.toLowerCase().replace(/ё/g, "е").replace(/\s/g, "");
  const dup = staff.find((s) => key(s.name) === key(name));
  if (dup) return sNameErr(dup.sign === sign ? `«${dup.name}» уже есть в списке`
    : `«${dup.name}» уже есть в списке как ${dup.sign ? "подписант" : "инженер"}. Сменить роль можно кнопкой рядом с именем в списке`);
  sNameErr(""); staff.push({ name, pos, sign });
  const ok = save(KEY.staff, staff); $("sName").value = ""; renderStaff();
  if (ok) toast(`${name} — в списке ${sign ? "подписантов" : "сотрудников"}`);
};
// поля с data-set хранятся в настройках и переживают «Новый»: производитель, подразделение, подписи отчёта
const showSettings = () => document.querySelectorAll("[data-set]").forEach((i) => (i.value = settings[i.dataset.set] ?? ""));
// одно и то же значение может стоять в двух документах (подразделение, должность ответственного) — держим поля в согласии
document.querySelectorAll("[data-set]").forEach((i) => (i.oninput = () => {
  settings[i.dataset.set] = i.value; save(KEY.set, settings);
  document.querySelectorAll(`[data-set=${i.dataset.set}]`).forEach((o) => { if (o !== i) o.value = i.value; });
}));
// подписанты: Ф. И. О. из списка сотрудников подставляет должность; нового человека можно запомнить одним касанием
const byName = (n) => staff.find((s) => s.name === n.trim());
function svBtn(i) {
  let b = i.closest(".fld").querySelector(".sv");
  if (!b) {
    b = mk(`<button type="button" class="sv">${ic("plus")}Запомнить в списке сотрудников</button>`);
    b.onclick = () => {
      staff.push({ name: i.value.trim(), pos: $(i.dataset.pos).value.trim(), sign: true });
      const ok = save(KEY.staff, staff); renderStaff(); if (ok) toast(`${i.value.trim()} — в списке подписантов`);
    };
    i.closest(".fld").appendChild(b);
  }
  b.classList.toggle("hide", !i.value.trim() || !!byName(i.value));
}
document.querySelectorAll("[data-pos]").forEach((i) => i.addEventListener("input", () => {
  const p = byName(i.value), pos = $(i.dataset.pos);
  if (p && p.pos && pos.value !== p.pos) { pos.value = p.pos; pos.dispatchEvent(new Event("input", { bubbles: true })); }
  svBtn(i);
}));
// выпадающий список вместо datalist: на Android datalist уходит в строку подсказок клавиатуры, а не списком под полем
document.querySelectorAll("[data-pos]").forEach((i) => {
  const b = mk(`<button type="button" class="dd" aria-label="Выбрать из списка">${ic("next")}</button>`), menu = mk(`<div class="menu hide"></div>`);
  b.onclick = () => {
    const was = menu.classList.contains("hide");
    document.querySelectorAll(".menu").forEach((m) => m.classList.add("hide"));
    if (!was) return;
    menu.innerHTML = staff.length ? "" : '<p class="empty" style="padding:10px 14px">Список сотрудников пуст</p>';
    staff.forEach((s) => {
      const o = mk(`<button type="button"><b></b><small></small></button>`);
      o.querySelector("b").textContent = s.name; o.querySelector("small").textContent = s.pos;
      o.onclick = () => { i.value = s.name; i.dispatchEvent(new Event("input", { bubbles: true })); menu.classList.add("hide"); };
      menu.appendChild(o);
    });
    menu.classList.remove("hide");
  };
  i.parentElement.append(b, menu);
});
document.addEventListener("click", (e) => { if (!e.target.closest(".dd,.menu")) document.querySelectorAll(".menu").forEach((m) => m.classList.add("hide")); });
showSettings();

// ---------- архив ----------
const KINDS = { act: { name: "Акт о сервисе", icon: "file" }, exp: { name: "Акт о материалах", icon: "cart" }, hoz: { name: "Акт о хозрасходах", icon: "coin" } };
function renderHist() {
  $("hList").innerHTML = hist.length ? "" : '<p class="empty">Пока пусто. Документ попадает сюда при сохранении DOCX или PDF.</p>';
  const tab = go;
  hist.forEach((h, i) => {
    const k = h.kind || "act", t = KINDS[k];
    const r = mk(`<div class="it">${ic(t.icon)}<div><b></b><small></small></div></div>`);
    r.querySelector("b").textContent = k === "exp" ? h.goal || "(без цели)" : k === "hoz" ? h.goal[0] || "(без цели)" : h.customer || "(без заказчика)";
    r.querySelector("small").textContent = [t.name, ...(k === "act" ? [h.machine, h.serial, h.dateText]
      : [h.dateText || h.checks[0]?.date, "чеков: " + h.checks.length, money(checksTotal(h.checks))])].filter(Boolean).join(" · ");
    const o = mk(`<button class="btn">Открыть</button>`);
    o.onclick = () => {
      if (k === "exp") { curExpId = h._id; fillExp(h); } else if (k === "hoz") { curHozId = h._id; fillHoz(h); } else { curId = h._id; fill(h); }
      tab(k);
    };
    const c = mk(`<button class="btn">Копия</button>`);
    c.onclick = () => {
      if (k === "exp") { curExpId = null; fillExp(h); persistExp(); }
      else if (k === "hoz") { curHozId = null; fillHoz({ ...h, _iso: todayISO() }); persistHoz(); }
      else { curId = null; fill({ ...h, _iso: todayISO() }); persist(); }
      tab(k);
    };
    const x = mk(`<button class="btn d" aria-label="Удалить">${ic("trash")}</button>`);
    x.onclick = () => { if (confirm(`Удалить «${t.name}» из архива?`)) { hist.splice(i, 1); save(KEY.hist, hist); renderHist(); } };
    r.append(o, c, x); $("hList").appendChild(r);
  });
  ["customer", "address", "machine", "contract"].forEach((k) => {
    const dl = $("dl-" + k); dl.innerHTML = "";
    [...new Set(hist.map((h) => h[k]).filter(Boolean))].forEach((v) => { const o = document.createElement("option"); o.value = v; dl.appendChild(o); });
  });
}
function archive(d) {
  if (d.kind === "exp") d._id = curExpId = curExpId || Date.now();
  else if (d.kind === "hoz") d._id = curHozId = curHozId || Date.now();
  else d._id = curId = curId || Date.now();
  hist = [d, ...hist.filter((h) => h._id !== d._id)].slice(0, 100);
  save(KEY.hist, hist); renderHist();
}
$("backupExp").onclick = () => dl(new Blob([JSON.stringify({ staff, hist, settings })], { type: "application/json" }), `akt-backup-${todayISO()}.json`);
$("imp").onclick = () => $("impFile").click();
$("impFile").onchange = async (e) => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (!confirm("Заменить текущие данные резервной копией?")) return;
    staff = j.staff || []; hist = j.hist || []; settings = { ...SET_DEF, ...(j.settings || settings) };
    save(KEY.staff, staff); save(KEY.hist, hist); save(KEY.set, settings);
    markSigners(); showSettings(); engIdx = respIdx = hrespIdx = engAt(-1); renderStaff(); renderHist(); toast("Импортировано");
  } catch { toast("Не удалось прочитать файл"); }
  e.target.value = "";
};

// ---------- файл / просмотр ----------
function dl(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const sumName = (d) => [d.checks[0]?.date, checksTotal(d.checks).toFixed(2).replace(".", ",") + "_руб"].join("_");
const fname = (d) => (d.kind === "exp" ? "Отчет_о_покупке_" + sumName(d) : d.kind === "hoz" ? "Отчет_о_хозрасходах_" + sumName(d)
  : "Акт_" + [d.customer, d.machine, d.serial, d.dateText.replace(/[«»]/g, "").trim()].filter(Boolean).join("_")).replace(/[\\/:*?"<>|\s]+/g, "_") + ".docx";
let lastBlob = null, lastData = null;

async function openPreview(kind = "act") {
  const [get, check, build] = { act: [collect, validate, buildDoc], exp: [collectExp, validateExp, buildExp], hoz: [collectHoz, validateHoz, buildHoz] }[kind];
  const d = get(), bad = check(d);
  if (bad.length) {
    toast("Заполните отмеченные поля");
    if (kind === "act") revealEl(bad[0]);
    bad[0].scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  try {
    lastData = d; pvKind = kind;
    lastBlob = await DOCXLIB.Packer.toBlob(build(DOCXLIB, d));
    const box = $("pvpage"); box.innerHTML = ""; box.style.zoom = 1;
    await DOCXPREV.renderAsync(lastBlob, box, null, { inWrapper: false, breakPages: true });
    $("pv").classList.add("on"); document.body.style.overflow = "hidden"; persistAll();
    const sec = box.querySelector("section");
    if (sec) box.style.zoom = Math.min(1, (window.innerWidth - 12) / sec.offsetWidth);
  } catch (e) { console.error(e); toast("Ошибка сборки документа"); }
}
$("preview").onclick = () => openPreview("act");
$("expPreview").onclick = () => openPreview("exp");
$("hozPreview").onclick = () => openPreview("hoz");
$("pvClose").onclick = () => { $("pv").classList.remove("on"); document.body.style.overflow = ""; persistAll(); };
$("pvDocx").onclick = () => { dl(lastBlob, fname(lastData)); archive({ ...lastData }); toast("DOCX сохранён"); };
// PDF собирается в приложении из отрисованных листов: системная печать в установленном PWA ненадёжна
async function makePdf() {
  const box = $("pvpage"), z = box.style.zoom; box.style.zoom = 1;
  try {
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    const secs = [...box.querySelectorAll("section")];
    for (let i = 0; i < secs.length; i++) {
      const c = await html2canvas(secs[i], { scale: 2, backgroundColor: "#ffffff" });
      if (i) pdf.addPage();
      const h = 210 * c.height / c.width, k = h > 297 ? 297 / h : 1; // не сжимать: если лист выше A4, вписать целиком
      pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", (210 - 210 * k) / 2, 0, 210 * k, h * k);
    }
    return pdf.output("blob");
  } finally { box.style.zoom = z; }
}
$("pvPdf").onclick = async () => {
  const b = $("pvPdf"); b.disabled = true; toast("Готовлю PDF…");
  try {
    dl(await makePdf(), fname(lastData).replace(/\.docx$/, ".pdf"));
    archive({ ...lastData }); toast("PDF сохранён");
  } catch (e) { console.error(e); toast("Не удалось создать PDF"); }
  b.disabled = false;
};
$("newAct").onclick = () => {
  if (!confirm("Очистить форму для нового акта?")) return;
  curId = null; fill({ warranty: "warranty", _eng: engIdx }); persist(); window.scrollTo(0, 0);
};

// ---------- листы: шаги на телефоне, оглавление и основная надпись на планшете ----------
const narrow = matchMedia("(max-width:819px)");
let step = 0;
const secs = () => [...document.querySelectorAll("#act .sec")].filter((s) => !s.classList.contains("hide"));
const SEC_DONE = {
  type: () => true,
  obj: () => $("customer").value.trim() && $("machine").value.trim(),
  work: () => $("works").value.trim(),
  parts: () => !$("partsOn").checked || [...$("parts").querySelectorAll("[data-f=name]")].some((i) => i.value.trim()),
  labor: () => $("labor").children.length && [...$("labor").querySelectorAll("[data-f=work]")].every((i) => num(i.value) > 0),
  sign: hasEng,
};
function showStep(i) { step = i; refreshSteps(); window.scrollTo(0, 0); }
function revealEl(el) { const j = secs().findIndex((s) => s.contains(el)); if (j >= 0 && narrow.matches) showStep(j); }
function refreshSteps() {
  const s = secs();
  document.body.classList.add("steps"); // без этого скрипта разделы остаются видимыми
  step = Math.max(0, Math.min(step, s.length - 1));
  s.forEach((x, j) => x.classList.toggle("cur", j === step));
  const title = (x) => x.querySelector("h2").textContent;
  $("stN").textContent = step + 1; $("stT").textContent = s.length; $("stName").textContent = title(s[step]);
  $("ticks").innerHTML = s.map((_, j) => `<i class="${j < step ? "done" : j === step ? "cur" : ""}"></i>`).join("");
  $("stPrev").disabled = step === 0;
  document.body.classList.toggle("last", step === s.length - 1);
  $("rail").innerHTML = "<p>Разделы</p>";
  s.forEach((x, j) => {
    const b = mk(`<button type="button" class="rl"><i class="mk"></i><span></span></button>`);
    b.querySelector("span").textContent = title(x);
    b.classList.toggle("done", !!SEC_DONE[x.dataset.s]());
    b.onclick = () => (narrow.matches ? showStep(j) : x.scrollIntoView({ behavior: "smooth", block: "start" }));
    $("rail").appendChild(b);
  });
  $("tbC").textContent = $("customer").value.trim() || "—";
  $("tbM").textContent = [$("machine").value.trim(), $("serial").value.trim()].filter(Boolean).join(" № ") || "—";
  $("tbD").textContent = fmtShort($("date").value) || "—";
}
$("stPrev").onclick = () => showStep(step - 1);
$("stNext").onclick = () => showStep(step + 1);
$("act").addEventListener("input", refreshSteps);
narrow.addEventListener("change", refreshSteps);

// ---------- отчёт о хозрасходах ----------
// чек: ФД, дата, сумма (из QR-кода или вручную); в материалах ещё позиции (items), в хозрасходах — нет.
// В списке чек свёрнут в строку «№ · ФД · дата · сумма», поля раскрываются по касанию, открыт один за раз
const money = (n) => (+n || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
function addCheck(c = {}, box = $("checks"), withItems = true, open = false) {
  const r = mk(`<div class="irow"></div>`);
  r.append(field("ФД №", "fd", c.fd || "", { err: "Укажите номер ФД" }), field("Дата чека", "date", c.date || todayISO(), { type: "date" }),
    field("Сумма, руб.", "sum", c.sum || "", { err: "Укажите сумму" }));
  r.querySelector("[data-f=fd]").inputMode = "numeric"; r.querySelector("[data-f=sum]").inputMode = "decimal";
  const items = mk(`<div class="fld"><label>Позиции</label><div class="inw m"><textarea data-f="items" style="min-height:96px"></textarea></div>
    <p class="hint">Одна строка — одна позиция. Цену можно дописать в конце: «Клей 20 г – 381 р.»</p></div>`);
  items.querySelector("textarea").value = c.items || "";
  const head = mk(`<button type="button" class="ck-sum" aria-expanded="false"><span class="ck-n"></span><span class="ck-fd"><b></b><small></small></span><span class="ck-s"></span>${ic("next")}</button>`);
  const it = item(withItems ? [head, r, items] : [head, r], () => box.dispatchEvent(new Event("input", { bubbles: true })));
  it.classList.add("ck");
  head.onclick = () => openCheck(it, !it.classList.contains("open"));
  box.appendChild(it); mics(it);
  box.closest(".bad")?.classList.remove("bad");
  ckLabels(box);
  if (open) { openCheck(it, true); it.querySelector("[data-f=fd]").focus(); }
  return it;
}
function openCheck(it, on) {
  it.parentElement.querySelectorAll(".ck.open").forEach((x) => { if (x !== it) { x.classList.remove("open"); x.firstChild.setAttribute("aria-expanded", "false"); } });
  it.classList.toggle("open", on); it.firstChild.setAttribute("aria-expanded", String(on));
}
function ckLabels(box) {
  [...box.children].forEach((it, i) => {
    const g = (f) => it.querySelector(`[data-f=${f}]`)?.value.trim() || "", b = it.querySelector(".ck-fd b"), n = lines(g("items")).length;
    it.querySelector(".ck-n").textContent = i + 1;
    b.textContent = g("fd") ? "ФД № " + g("fd") : "ФД не указан"; b.classList.toggle("no", !g("fd"));
    it.querySelector(".ck-fd small").textContent = [fmtShort(g("date")), n ? "позиций: " + n : ""].filter(Boolean).join(" · ");
    it.querySelector(".ck-s").textContent = num(g("sum")) > 0 ? money(num(g("sum"))) : "—";
  });
}
// проверка чеков: пустой список или чек без ФД/суммы; первый чек с ошибкой раскрывается
function markChecks(box, mark) {
  mark(box, !box.children.length);
  [...box.children].forEach((it) => {
    const g = (f) => it.querySelector(`[data-f=${f}]`);
    mark(g("fd"), !g("fd").value.trim());
    mark(g("sum"), !(num(g("sum").value) > 0));
  });
  const first = [...box.children].find((x) => x.querySelector(".bad"));
  if (first) openCheck(first, true);
}
$("addCheck").onclick = () => { addCheck({}, $("checks"), true, true); persistExp(); };

function collectExp() {
  const rows = rowsOf($("checks")), s = staff[respIdx] || {};
  return {
    kind: "exp", dept: settings.dept, goal: $("goal").value.trim(),
    checks: rows.map((c) => ({ fd: c.fd, date: fmtShort(c.date), sum: num(c.sum) || 0, items: lines(c.items) })),
    respName: s.name || "", respPos: settings.respPos.trim() || s.pos || "",
    apprPos: settings.apprPos, apprName: settings.apprName, dirPos: settings.dirPos, dirName: settings.dirName,
    _checks: rows, _resp: respIdx,
  };
}
function fillExp(d) {
  $("goal").value = d.goal || "";
  $("checks").innerHTML = "";
  (d._checks || []).forEach((c) => addCheck(c));
  respIdx = engAt(d._resp);
  renderStaff(); refreshExp();
}
function persistExp() { save(KEY.expDraft, { ...collectExp(), _id: curExpId, _pv: pvOpen("exp") }); }
function refreshExp() {
  const d = collectExp();
  $("expTot").textContent = $("tbT").textContent = rub(checksTotal(d.checks));
  $("tbG").textContent = d.goal || "—"; $("tbN").textContent = d.checks.length; ckLabels($("checks"));
}
$("exp").addEventListener("input", (e) => { e.target.closest(".bad")?.classList.remove("bad"); refreshExp(); persistExp(); });
$("exp").addEventListener("change", persistExp);
function validateExp(d) {
  document.querySelectorAll("#exp .bad").forEach((e) => e.classList.remove("bad"));
  const bad = [];
  const mark = (el, cond) => { if (cond) { const f = el.closest(".fld") || el; f.classList.add("bad"); bad.push(f); } };
  mark($("goal"), !d.goal);
  markChecks($("checks"), mark);
  if (!hasEng()) mark($("resp"), true);
  return bad;
}
$("expNew").onclick = () => {
  if (!confirm("Очистить форму для нового отчёта?")) return;
  curExpId = null; fillExp({ _resp: respIdx }); persistExp(); window.scrollTo(0, 0);
};

// ---------- отчёт о хозрасходах (АО): таблица ФД без позиций ----------
const addHozCheck = (c = {}) => addCheck(c, $("hChecks"), false);
$("hAddCheck").onclick = () => { addCheck({}, $("hChecks"), false, true); persistHoz(); };
function collectHoz() {
  const rows = rowsOf($("hChecks")), s = staff[hrespIdx] || {}, iso = $("hDate").value, [y, m, dd] = iso ? iso.split("-") : [];
  return {
    kind: "hoz", dept: settings.dept, project: $("hProject").value.trim(), goal: [...lines($("hGoal").value), ...lines($("hEng").value).map((n) => "- " + n.replace(/^[-–—]\s*/, ""))],
    checks: rows.map((c) => ({ fd: c.fd, date: fmtShort(c.date), sum: num(c.sum) || 0 })),
    apprPos: settings.hozApprPos, apprName: settings.hozApprName,
    respName: s.name || "", respPos: settings.respPos.trim() || s.pos || "",
    dateText: iso ? `« ${+dd} » ${MONTHS[m - 1]} ${y} г.` : "",
    _checks: rows, _resp: hrespIdx, _iso: iso, _txt: { goal: $("hGoal").value, eng: $("hEng").value, project: $("hProject").value },
  };
}
function fillHoz(d) {
  $("hGoal").value = d._txt?.goal ?? ""; $("hEng").value = d._txt?.eng ?? ""; $("hProject").value = d._txt?.project ?? "";
  $("hDate").value = d._iso || todayISO();
  $("hChecks").innerHTML = "";
  (d._checks || []).forEach((c) => addHozCheck(c));
  hrespIdx = engAt(d._resp);
  renderStaff(); refreshHoz();
}
function persistHoz() { save(KEY.hozDraft, { ...collectHoz(), _id: curHozId, _pv: pvOpen("hoz") }); }
function persistAll() { persist(); persistExp(); persistHoz(); }
function refreshHoz() {
  const d = collectHoz();
  $("hTot").textContent = $("tbHT").textContent = rub(checksTotal(d.checks));
  $("tbHG").textContent = d.goal[0] || "—"; $("tbHN").textContent = d.checks.length; ckLabels($("hChecks"));
}
$("hoz").addEventListener("input", (e) => { e.target.closest(".bad")?.classList.remove("bad"); refreshHoz(); persistHoz(); });
$("hoz").addEventListener("change", persistHoz);
function validateHoz(d) {
  document.querySelectorAll("#hoz .bad").forEach((e) => e.classList.remove("bad"));
  const bad = [];
  const mark = (el, cond) => { if (cond) { const f = el.closest(".fld") || el; f.classList.add("bad"); bad.push(f); } };
  mark($("hGoal"), !lines($("hGoal").value).length);
  markChecks($("hChecks"), mark);
  if (!hasEng()) mark($("hResp"), true);
  return bad;
}
$("hozNew").onclick = () => {
  if (!confirm("Очистить форму для нового отчёта?")) return;
  curHozId = null; fillHoz({ _resp: hrespIdx }); persistHoz(); window.scrollTo(0, 0);
};

// QR-код кассового чека: t=20250920T1234&s=15990.00&fn=…&i=19478&fp=…&n=1, где i — номер ФД
function parseCheckQR(s) {
  const p = new URLSearchParams(String(s).trim()), t = p.get("t") || "", i = p.get("i");
  if (!i) return null;
  return { fd: i, date: /^\d{8}/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : "", sum: (p.get("s") || "").replace(".", ",") };
}
console.assert(JSON.stringify(parseCheckQR("t=20250920T1234&s=15990.00&fn=7380440800&i=19478&fp=123&n=1")) === '{"fd":"19478","date":"2025-09-20","sum":"15990,00"}', "parseCheckQR");
let detector = null;
try { if ("BarcodeDetector" in window) detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch {}
// на iPad BarcodeDetector нет — jsQR
async function detectQR(src, w, h, fast) {
  if (detector) { try { const r = await detector.detect(src); if (r[0]) return r[0].rawValue; } catch {} }
  if (!window.jsQR) return null;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
  return jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: fast ? "dontInvert" : "attemptBoth" })?.data || null;
}
// фото из галереи: код на чеке мелкий, поэтому несколько масштабов
async function readQR(file) {
  const img = await createImageBitmap(file);
  for (const max of [1600, 1000, 2400, 700]) {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const r = await detectQR(img, Math.round(img.width * k), Math.round(img.height * k));
    if (r) return r;
    if (detector) break; // детектор сам смотрит всё фото, масштабы нужны только jsQR
  }
  return null;
}

// куда кладём найденные чеки: «Материалы» или «Хозрасходы»
let scanBox = null;
// один и тот же чек дважды не добавляем: ФД уникален только в своём ФН, поэтому вместе с датой и суммой
const checkKey = (c) => [c.fd, fmtShort(c.date), num(c.sum) || 0].join("|");
// новый чек из QR. Возвращает текст для подсказки
function addScanned(raw) {
  const c = parseCheckQR(raw);
  if (!c) return "Это не QR-код кассового чека";
  if (rowsOf(scanBox).some((r) => checkKey(r) === checkKey(c))) return `ФД № ${c.fd} уже в списке`;
  const it = scanBox === $("checks") ? addCheck(c) : addHozCheck(c);
  it.classList.add("new"); setTimeout(() => it.classList.remove("new"), 1300);
  scanBox.dispatchEvent(new Event("input", { bubbles: true })); // форма сама пересчитает итог и сохранит черновик
  return `Добавлен ФД № ${c.fd} · ${money(num(c.sum))}`;
}
document.querySelectorAll("[data-gal]").forEach((b) => (b.onclick = () => { scanBox = $(b.dataset.gal); $("qrFile").click(); }));
// фото из галереи (можно несколько сразу) и с камеры — запасной путь без живой камеры
$("qrFile").onchange = $("qrCam").onchange = async (e) => {
  const files = [...e.target.files]; e.target.value = "";
  if (!files.length || !scanBox) return;
  toast("Ищу QR-код…");
  let ok = 0, miss = 0, last = "";
  for (const f of files) {
    try { const raw = await readQR(f); if (raw) { last = addScanned(raw); ok += last.startsWith("Добавлен"); } else miss++; } catch (err) { console.error(err); miss++; }
  }
  toast(files.length === 1 ? (miss ? "QR-код не найден. Попробуйте «Сканировать QR» или введите вручную" : last)
    : `Добавлено чеков: ${ok}` + (miss ? `, без QR-кода: ${miss}` : ""));
};

// живой сканер: кадры с камеры, читаем только область прицела — быстрее и надёжнее, чем одно фото
let scanStream = null, scanTimer = 0, scanLast = "", scanN = 0;
document.querySelectorAll("[data-scan]").forEach((b) => (b.onclick = () => startScan($(b.dataset.scan))));
async function startScan(box) {
  scanBox = box;
  if (!navigator.mediaDevices?.getUserMedia) return $("qrCam").click();
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } });
  } catch (e) {
    console.error(e); toast("Камера недоступна — сделайте фото чека"); return $("qrCam").click();
  }
  const v = $("scanV"), tr = scanStream.getVideoTracks()[0];
  try { await tr.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch {}
  $("scanTorch").classList.toggle("hide", !tr.getCapabilities?.().torch);
  scanLast = ""; scanN = 0; $("scanMsg").textContent = "Наведите камеру на QR-код чека. Чеки можно снимать подряд.";
  $("scan").classList.remove("hide"); document.body.style.overflow = "hidden";
  v.srcObject = scanStream; await v.play().catch(() => {});
  scanTick();
}
async function scanTick() {
  const v = $("scanV");
  if (!scanStream) return;
  if (v.readyState >= 2 && v.videoWidth) {
    // прицел в пикселях кадра: видео растянуто по cover; берём область в 1,4 раза больше прицела
    const W = v.videoWidth, H = v.videoHeight, rv = v.getBoundingClientRect(), k = Math.max(rv.width / W, rv.height / H);
    const win = $("scan").querySelector(".scan-win").getBoundingClientRect();
    const side = Math.min(W, H, (win.width * 1.4) / k);
    const cx = W / 2 + (win.left + win.width / 2 - rv.left - rv.width / 2) / k, cy = H / 2 + (win.top + win.height / 2 - rv.top - rv.height / 2) / k;
    const sx = Math.max(0, Math.min(W - side, cx - side / 2)), sy = Math.max(0, Math.min(H - side, cy - side / 2));
    const out = Math.min(800, Math.round(side)), c = document.createElement("canvas");
    c.width = c.height = out; c.getContext("2d").drawImage(v, sx, sy, side, side, 0, 0, out, out);
    const raw = await detectQR(c, out, out, true).catch(() => null);
    if (raw && raw !== scanLast && scanStream) {
      scanLast = raw;
      const m = addScanned(raw);
      if (m.startsWith("Добавлен")) { scanN++; navigator.vibrate?.(60); }
      $("scanMsg").textContent = m + (scanN ? `. Добавлено за сеанс: ${scanN}` : "");
    }
  }
  scanTimer = setTimeout(scanTick, 120);
}
function stopScan() {
  clearTimeout(scanTimer);
  scanStream?.getTracks().forEach((t) => t.stop()); scanStream = null;
  $("scanV").srcObject = null; $("scan").classList.add("hide"); document.body.style.overflow = "";
}
$("scanDone").onclick = stopScan;
$("scanTorch").onclick = async () => {
  const on = !$("scanTorch").classList.contains("on");
  try {
    await scanStream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: on }] });
    $("scanTorch").classList.toggle("on", on); $("scanTorch").textContent = on ? "Выключить фонарик" : "Фонарик";
  } catch {}
};
document.addEventListener("visibilitychange", () => { if (document.hidden && scanStream) stopScan(); });

// ---------- старт ----------
renderHist();
try { const dr = load(KEY.draft, null); if (dr) { curId = dr._id || null; fill(dr); if (dr._pv) { go("act"); openPreview(); } } else fill({}); } catch { fill({}); }
try {
  const de = load(KEY.expDraft, null); curExpId = de?._id || null; fillExp(de || {});
  if (de?._pv) { go("exp"); openPreview("exp"); }
} catch { fillExp({}); }
try {
  const dh = load(KEY.hozDraft, null); curHozId = dh?._id || null; fillHoz(dh || {});
  if (dh?._pv) { go("hoz"); openPreview("hoz"); }
} catch { fillHoz({}); }
go(curDoc || "home"); // curDoc задан, только если восстановлен открытый просмотр
mics();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
