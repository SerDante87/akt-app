// Строит docx акта по данным d; docx — библиотека docx (в браузере window.docx, в node require('docx')).
// Макет повторяет эталон «Акт о проведении сервисных работ YKZ7250A.docx».
function buildDoc(docx, d) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
    AlignmentType, VerticalAlign, TableLayoutType, VerticalMergeType, HeightRule, TabStopType } = docx;

  const W = [1172, 1626, 695, 1175, 700, 746, 970, 3159]; // сетка эталона, twips
  const span = (a, n) => W.slice(a, a + n).reduce((s, x) => s + x, 0);
  const thick = { style: BorderStyle.SINGLE, size: 12, color: "000000" };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const fill = (arr, n) => arr.concat(Array(Math.max(0, n - arr.length)).fill(""));

  const run = (t, o = {}) => new TextRun({ text: String(t ?? ""), size: 18, ...o });
  const para = (children, o = {}) => new Paragraph({ spacing: { before: 0, after: 0 }, children, ...o });
  const lab = (t) => para([run(t, { bold: true, size: 16 })]);

  function cell(a, n, children, o = {}) {
    return new TableCell({
      columnSpan: n > 1 ? n : undefined,
      width: { size: span(a, n), type: WidthType.DXA },
      verticalAlign: o.v || VerticalAlign.TOP,
      verticalMerge: o.vm,
      borders: o.borders,
      margins: { left: 80, right: 60, top: 20, bottom: 20 },
      children,
    });
  }
  const row = (cells, h = 315) => new TableRow({ children: cells, cantSplit: true, height: { value: h, rule: HeightRule.ATLEAST } });
  const center = (t, o = {}) => para([run(t, { bold: true, ...o })], { alignment: AlignmentType.CENTER });

  const head = (t) => row([cell(0, 8, [center(t)], { borders: { top: thick, bottom: thick } })], 280);
  const lines = (arr, min) => fill(arr, min).map((t) =>
    row([cell(0, 8, [para([run(t, { size: 20 })])], { v: VerticalAlign.CENTER })]));

  const box = (on) => run(on ? "☒" : "☐", { size: 26, font: "Segoe UI Symbol" });
  const w = d.warranty;
  const checks = para([
    box(w === "warranty"), run("  Гарантия", { bold: true }), run("\t"),
    box(w === "none"), run("  Нет гарантии", { bold: true }), run("\t"),
    box(w === "commission"), run("  Ввод в эксплуатацию", { bold: true }),
  ], { tabStops: [{ type: TabStopType.LEFT, position: 2800 }, { type: TabStopType.LEFT, position: 6000 }] });

  // «Виды работ» режем на строки по ширине ряда; на листе 1 — 7 строк, дальше — продолжение на следующих листах
  const CAP = 7, CPL = 92, CAP2 = 36;
  const wrapLine = (s) => {
    const out = []; let cur = "";
    for (const w of s.split(/\s+/)) {
      if (cur && (cur + " " + w).length > CPL) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
    }
    return out.concat(cur ? [cur] : []);
  };
  const wr = d.works.flatMap(wrapLine);
  const sheets = [];
  if (wr.length <= CAP) sheets.push(wr);
  else {
    sheets.push([...wr.slice(0, CAP - 1), "(продолжение на листе 2)"]);
    for (let i = CAP - 1; i < wr.length; i += CAP2) sheets.push(wr.slice(i, i + CAP2));
  }
  const total = sheets.length;
  const mark = (n) => total > 1 ? [para([run(`Лист ${n} из ${total}`, { size: 16 })], { alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 60 } })] : [];
  const title = (cont) => para([run("Акт о проведении сервисных работ" + (cont ? " (продолжение)" : ""), { bold: true, size: 24 })], { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 } });

  const top = [
    row([
      cell(0, 5, [lab("Заказчик"), center(d.customer)]),
      cell(5, 3, [lab("Производитель"), center(d.manufacturer)]),
    ], 510),
    row([
      cell(0, 5, [lab("Адрес проведения работ"), center(d.address)]),
      cell(5, 3, [lab("Тип станка"), center(d.machine)]),
    ], 510),
    row([
      cell(0, 5, [para([run("Договор или Контракт ", { bold: true }), run(d.contract, { bold: true })])]),
      cell(5, 3, [lab("Заводской номер"), center(d.serial)]),
    ], 510),
    row([cell(0, 8, [checks], { v: VerticalAlign.CENTER })], 400),
  ];
  const rows = [
    ...top,
    head("Содержание запроса"), ...lines(d.request, 3),
    head("Виды работ и/или заключение"), ...lines(sheets[0], 7),
    head("Замечания"), ...lines(d.remarks, 3),
    row([
      cell(0, 4, [center("Запчасти")], { borders: { top: thick, bottom: thick } }),
      cell(4, 2, [center("Кол.")], { borders: { top: thick, bottom: thick } }),
      cell(6, 2, [center("Замечания")], { borders: { top: thick, bottom: thick } }),
    ], 280),
    ...fill(d.parts, 4).map((p) => row([
      cell(0, 4, [para([run(p.name, { size: 20 })])], { v: VerticalAlign.CENTER }),
      cell(4, 2, [center(p.qty)], { v: VerticalAlign.CENTER }),
      cell(6, 2, [para([run(p.note, { size: 20 })])], { v: VerticalAlign.CENTER }),
    ])),
    row([
      cell(0, 1, [center("Дата")], { vm: VerticalMergeType.RESTART, borders: { top: thick } }),
      cell(1, 3, [center("Кол-во часов")], { borders: { top: thick } }),
      cell(4, 2, [center("Количество сервис-инженеров", { size: 16 })], { vm: VerticalMergeType.RESTART, borders: { top: thick } }),
      cell(6, 2, [center("Замечания")], { vm: VerticalMergeType.RESTART, borders: { top: thick } }),
    ], 280),
    row([
      cell(0, 1, [para([])], { vm: VerticalMergeType.CONTINUE }),
      cell(1, 1, [center("Проезд")], { borders: { bottom: thick } }),
      cell(2, 2, [center("Работа")], { borders: { bottom: thick } }),
      cell(4, 2, [para([])], { vm: VerticalMergeType.CONTINUE }),
      cell(6, 2, [para([])], { vm: VerticalMergeType.CONTINUE }),
    ], 280),
    ...fill(d.labor, 4).map((l) => row([
      cell(0, 1, [para([run(l.date)])], { v: VerticalAlign.CENTER }),
      cell(1, 1, [center(l.trip)], { v: VerticalAlign.CENTER }),
      cell(2, 2, [center(l.work)], { v: VerticalAlign.CENTER }),
      cell(4, 2, [center(l.eng)], { v: VerticalAlign.CENTER }),
      cell(6, 2, [para([run(l.note)])], { v: VerticalAlign.CENTER }),
    ])),
  ];

  const mkTable = (rs) => new Table({
    rows: rs, columnWidths: W, layout: TableLayoutType.FIXED,
    width: { size: span(0, 8), type: WidthType.DXA },
    borders: { top: thick, bottom: thick, left: thick, right: thick, insideHorizontal: thin, insideVertical: thin },
  });
  const table = mkTable(rows);

  const L = (t) => run(t, { size: 16 });
  const tab = (...pos) => ({ tabStops: pos.map((p) => ({ type: TabStopType.LEFT, position: p })) });
  const line = "_______________";
  const fio = d.engineerName || "___________________________";
  const customer = d.customer || "____________________________";

  const after = [
    para([run("К количеству и качеству работ Заказчик претензий не имеет. Настоящим подтверждаем все, что изложено в настоящем Акте.", { bold: true, italics: true })], { spacing: { before: 120, after: 0 } }),
    para([run("Дата        ", { bold: true }), run(d.dateText || "« _____ » ______________ 202   г.", { bold: true })]),
    para([]),
    para([
      run("От ООО \"Вебер Комеханикс\"", { bold: true, underline: {} }),
      run("\tОт Заказчика\t", { bold: true }),
      run(" " + customer + " ", { bold: true, underline: {} }),
    ], tab(4500, 5900)),
    para([L("\t\t\tПредприятие")], tab(4500, 5900, 7000)),
    para([]),
    para([run(line + "   / "), run(" " + fio + " ", { underline: {} }), run(" /\t" + line + "   / ______________________ /")], tab(5600)),
    para([L("\tПодпись\tФ. И. О.\tПодпись\tФ. И. О.")], tab(500, 2300, 5900, 7900)),
    para([]),
    para([run("\t" + (d.engineerPos || "сервисный инженер"), { bold: true }), run("\t____________________________")], tab(1400, 6200)),
    para([L("\t\tДолжность")], tab(1400, 6200)),
  ];

  const properties = { page: { size: { width: 11906, height: 16838 }, margin: { top: 700, bottom: 600, left: 600, right: 1060 } } };
  const extra = sheets.slice(1).map((chunk, i) => ({
    properties,
    children: [title(true), ...mark(i + 2),
      mkTable([...top, head("Виды работ и/или заключение (продолжение)"), ...lines(chunk, 0)])],
  }));

  return new Document({
    creator: "GearProduction",
    title: "Акт о проведении сервисных работ",
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{ properties, children: [title(false), ...mark(1), table, ...after] }, ...extra],
  });
}
if (typeof module !== "undefined") module.exports = buildDoc;
