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
  // Подвал — таблица без рамок: табуляции в разных просмотрщиках (Telegram, WPS, телефон) разъезжаются
  const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noB = { top: NB, bottom: NB, left: NB, right: NB };
  const ul = { ...noB, bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" } };
  const FW = [1700, 200, 2600, 200, 846, 1700, 200, 2600, 200];
  const fspan = (a, n) => FW.slice(a, a + n).reduce((s, x) => s + x, 0);
  const fc = (a, n, children, borders = noB, v = VerticalAlign.BOTTOM) => new TableCell({
    columnSpan: n > 1 ? n : undefined, width: { size: fspan(a, n), type: WidthType.DXA }, borders, verticalAlign: v,
    margins: { left: 40, right: 40, top: 0, bottom: 0 }, children,
  });
  const cp = (t, o = {}, al = AlignmentType.CENTER) => para([run(t, o)], { alignment: al });
  const cap = (t) => cp(t, { size: 16 });
  const fr = (cells, h) => new TableRow({ cantSplit: true, height: { value: h, rule: HeightRule.ATLEAST }, children: cells });
  const footer = new Table({
    columnWidths: FW, layout: TableLayoutType.FIXED, width: { size: fspan(0, 9), type: WidthType.DXA },
    borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB },
    rows: [
      fr([fc(0, 4, [cp("От ООО \"Вебер Комеханикс\"", { bold: true, underline: {} }, AlignmentType.LEFT)]), fc(4, 1, [para([])]),
        fc(5, 4, [para([run("От Заказчика   ", { bold: true }), run(d.customer || "", { bold: true, underline: {} })])])], 300),
      fr([fc(0, 5, [para([])]), fc(5, 4, [cap("Предприятие")], noB, VerticalAlign.TOP)], 260),
      fr([fc(0, 1, [para([])], ul), fc(1, 1, [cp("/")]), fc(2, 1, [cp(d.engineerName || "")], ul), fc(3, 1, [cp("/")]), fc(4, 1, [para([])]),
        fc(5, 1, [para([])], ul), fc(6, 1, [cp("/")]), fc(7, 1, [para([])], ul), fc(8, 1, [cp("/")])], 500),
      fr([fc(0, 1, [cap("Подпись")], noB, VerticalAlign.TOP), fc(1, 1, [para([])]), fc(2, 1, [cap("Ф. И. О.")], noB, VerticalAlign.TOP), fc(3, 1, [para([])]), fc(4, 1, [para([])]),
        fc(5, 1, [cap("Подпись")], noB, VerticalAlign.TOP), fc(6, 1, [para([])]), fc(7, 1, [cap("Ф. И. О.")], noB, VerticalAlign.TOP), fc(8, 1, [para([])])], 260),
      fr([fc(0, 4, [cp(d.engineerPos || "сервисный инженер", { bold: true })]), fc(4, 1, [para([])]), fc(5, 4, [para([])], ul)], 440),
      fr([fc(0, 5, [para([])]), fc(5, 4, [cap("Должность")], noB, VerticalAlign.TOP)], 260),
    ],
  });

  const after = [
    para([run("К количеству и качеству работ Заказчик претензий не имеет. Настоящим подтверждаем все, что изложено в настоящем Акте.", { bold: true, italics: true })], { spacing: { before: 120, after: 0 } }),
    para([run("Дата        ", { bold: true }), run(d.dateText || "« _____ » ______________ 202   г.", { bold: true })], { spacing: { before: 0, after: 160 } }),
    footer,
    // Word требует абзац после таблицы; делаем его почти нулевой высоты, чтобы не уходил на новую страницу
    para([run("", { size: 2 })], { spacing: { before: 0, after: 0, line: 20, lineRule: "exact" } }),
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
