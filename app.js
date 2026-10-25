"use strict";
const $ = (id) => document.getElementById(id);
const KEY = { staff: "akt.staff", hist: "akt.hist", set: "akt.set", draft: "akt.draft" };
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast("Память браузера недоступна"); } };
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const ic = (n) => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const num = (s) => parseFloat(String(s).replace(",", "."));

let staff = load(KEY.staff, []);
let hist = load(KEY.hist, []);
let settings = load(KEY.set, { manufacturer: "ООО «Вебер Комеханикс»" });
let curId = null, engIdx = 0;

function toast(t) {
  const e = $("toast"); e.textContent = t; e.style.display = "block";
  clearTimeout(toast.t); toast.t = setTimeout(() => (e.style.display = "none"), 3000);
}

// ---------- вкладки ----------
document.querySelectorAll("nav button").forEach((b) => b.onclick = () => {
  document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === b.dataset.t));
  $("actbar").classList.toggle("hide", b.dataset.t !== "act");
  window.scrollTo(0, 0);
});

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
function item(children) {
  const it = mk(`<div class="item"></div>`);
  children.forEach((c) => it.appendChild(c));
  const x = mk(`<button type="button" class="btn d del">${ic("trash")}Удалить</button>`);
  x.onclick = () => { it.remove(); sync(); persist(); };
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
  engIdx = d._eng >= 0 && d._eng < staff.length ? d._eng : 0;
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
function persist() { save(KEY.draft, { ...collect(), _id: curId, _pv: $("pv").classList.contains("on") }); }
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
  if (!staff.length) mark($("engineer"), true);
  return bad;
}

// ---------- сотрудники ----------
function renderStaff() {
  const box = $("engineer"); box.innerHTML = "";
  if (!staff.length) box.innerHTML = '<span class="empty">Список пуст</span>';
  staff.forEach((s, i) => {
    const c = mk(`<label class="chip"><input type="radio" name="eng" value="${i}"><span class="dot"></span><span><span class="n"></span><small></small></span></label>`);
    c.querySelector(".n").textContent = s.name; c.querySelector("small").textContent = s.pos;
    const r = c.querySelector("input"); r.checked = i === engIdx;
    r.onchange = () => { engIdx = i; persist(); };
    box.appendChild(c);
  });
  $("sList").innerHTML = staff.length ? "" : '<p class="empty">Список пуст</p>';
  staff.forEach((s, i) => {
    const r = mk(`<div class="it"><div><b></b><small></small></div></div>`);
    r.querySelector("b").textContent = s.name; r.querySelector("small").textContent = s.pos;
    const x = mk(`<button class="btn d" aria-label="Удалить">${ic("trash")}</button>`);
    x.onclick = () => { if (confirm(`Удалить «${s.name}»?`)) { staff.splice(i, 1); engIdx = 0; save(KEY.staff, staff); renderStaff(); persist(); } };
    r.appendChild(x); $("sList").appendChild(r);
  });
}
$("sAdd").onclick = () => {
  const name = $("sName").value.trim(), pos = $("sPos").value.trim() || "сервисный инженер";
  if (!name) return toast("Введите Ф. И. О.");
  staff.push({ name, pos }); save(KEY.staff, staff); $("sName").value = ""; renderStaff(); toast("Сотрудник добавлен");
};
$("manufacturer").value = settings.manufacturer;
$("manufacturer").oninput = (e) => { settings.manufacturer = e.target.value; save(KEY.set, settings); };

// ---------- архив ----------
function renderHist() {
  $("hList").innerHTML = hist.length ? "" : '<p class="empty">Пока пусто. Акт попадает сюда при сохранении DOCX или PDF.</p>';
  hist.forEach((h, i) => {
    const r = mk(`<div class="it"><div><b></b><small></small></div></div>`);
    r.querySelector("b").textContent = h.customer || "(без заказчика)";
    r.querySelector("small").textContent = [h.machine, h.serial, h.dateText].filter(Boolean).join(" · ");
    const o = mk(`<button class="btn">Открыть</button>`);
    o.onclick = () => { curId = h._id; fill(h); document.querySelector("nav button[data-t=act]").click(); };
    const c = mk(`<button class="btn">Копия</button>`);
    c.onclick = () => { curId = null; fill({ ...h, _iso: todayISO() }); document.querySelector("nav button[data-t=act]").click(); persist(); };
    const x = mk(`<button class="btn d" aria-label="Удалить">${ic("trash")}</button>`);
    x.onclick = () => { if (confirm("Удалить акт из архива?")) { hist.splice(i, 1); save(KEY.hist, hist); renderHist(); } };
    r.append(o, c, x); $("hList").appendChild(r);
  });
  ["customer", "address", "machine", "contract"].forEach((k) => {
    const dl = $("dl-" + k); dl.innerHTML = "";
    [...new Set(hist.map((h) => h[k]).filter(Boolean))].forEach((v) => { const o = document.createElement("option"); o.value = v; dl.appendChild(o); });
  });
}
function archive(d) {
  d._id = curId = curId || Date.now();
  hist = [d, ...hist.filter((h) => h._id !== d._id)].slice(0, 100);
  save(KEY.hist, hist); renderHist();
}
$("exp").onclick = () => dl(new Blob([JSON.stringify({ staff, hist, settings })], { type: "application/json" }), `akt-backup-${todayISO()}.json`);
$("imp").onclick = () => $("impFile").click();
$("impFile").onchange = async (e) => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (!confirm("Заменить текущие данные резервной копией?")) return;
    staff = j.staff || []; hist = j.hist || []; settings = j.settings || settings;
    save(KEY.staff, staff); save(KEY.hist, hist); save(KEY.set, settings);
    $("manufacturer").value = settings.manufacturer; engIdx = 0; renderStaff(); renderHist(); toast("Импортировано");
  } catch { toast("Не удалось прочитать файл"); }
  e.target.value = "";
};

// ---------- файл / просмотр ----------
function dl(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const fname = (d) => ("Акт_" + [d.customer, d.machine, d.serial, d.dateText.replace(/[«»]/g, "").trim()].filter(Boolean).join("_")).replace(/[\\/:*?"<>|\s]+/g, "_") + ".docx";
let lastBlob = null, lastData = null;

async function openPreview() {
  const d = collect(), bad = validate(d);
  if (bad.length) {
    toast("Заполните отмеченные поля");
    revealEl(bad[0]);
    bad[0].scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  try {
    lastData = d;
    lastBlob = await DOCXLIB.Packer.toBlob(buildDoc(DOCXLIB, d));
    const box = $("pvpage"); box.innerHTML = ""; box.style.zoom = 1;
    await DOCXPREV.renderAsync(lastBlob, box, null, { inWrapper: false, breakPages: true });
    $("pv").classList.add("on"); document.body.style.overflow = "hidden"; persist();
    const sec = box.querySelector("section");
    if (sec) box.style.zoom = Math.min(1, (window.innerWidth - 12) / sec.offsetWidth);
  } catch (e) { console.error(e); toast("Ошибка сборки акта"); }
}
$("preview").onclick = openPreview;
$("pvClose").onclick = () => { $("pv").classList.remove("on"); document.body.style.overflow = ""; persist(); };
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
  sign: () => staff.length > 0,
};
function showStep(i) { step = i; refreshSteps(); window.scrollTo(0, 0); }
function revealEl(el) { const j = secs().findIndex((s) => s.contains(el)); if (j >= 0 && narrow.matches) showStep(j); }
function refreshSteps() {
  const s = secs();
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

// ---------- старт ----------
renderHist();
try { const dr = load(KEY.draft, null); if (dr) { curId = dr._id || null; fill(dr); if (dr._pv) openPreview(); } else fill({}); } catch { fill({}); }
mics();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
