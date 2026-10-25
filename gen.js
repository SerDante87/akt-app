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
const rub = (n) => { const k = Math.round((+n || 0) * 100); return `${Math.floor(k / 100)} руб. ${String(k % 100).padStart(2, "0")} коп.`; };
const checksTotal = (checks) => checks.reduce((s, c) => s + (+c.sum || 0), 0);

// Гриф «Утверждаю» справа (Tahoma 12, левый отступ 324 pt как в образцах): значение на линии, подпись в скобках под ней
function stampParas(docx, pos, name) {
  const { Paragraph, TextRun, BorderStyle, AlignmentType } = docx;
  const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const ind = { left: 6480 };
  const run = (t, o = {}) => new TextRun({ text: t, font: "Tahoma", size: 24, ...o });
  const p = (t, o = {}, r = {}) => new Paragraph({ spacing: { before: 0, after: 0 }, indent: ind, alignment: AlignmentType.CENTER, children: [run(t, r)], ...o });
  const onLine = (t) => p(t || " ", { border: { bottom: line } });
  const cap = (t) => p(t, {}, { size: 16 });
  return [p("“Утверждаю”"), onLine(pos), cap("(должность)"), onLine(name), cap("(Ф.И.О.)"),
    p(" ", { spacing: { before: 200 }, border: { bottom: line } }), cap("(подпись)"),
    p("“____” _______________ 20__ г.", { spacing: { before: 120 } })];
}

// Отчёт о хозяйственных расходах по образцу «Покупка вспомогательных материалов WR600 WSBJ500.doc»:
// гриф «Утверждаю» справа (Tahoma), тело Times New Roman 12, подписи — таблицы без рамок.
// e: { dept, goal, checks: [{ fd, date: "дд.мм.гггг", sum: число, items: [строки] }], respPos, respName, apprPos, apprName, dirPos, dirName }
function buildExp(docx, e) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign, TableLayoutType, HeightRule } = docx;
  const TNR = "Times New Roman", TAH = "Tahoma";
  const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const run = (t, o = {}) => new TextRun({ text: String(t ?? ""), size: 24, ...o });
  const p = (children, o = {}) => new Paragraph({ spacing: { before: 0, after: 0 }, children, ...o });
  const C = AlignmentType.CENTER;
  const total = checksTotal(e.checks);

  const stamp = stampParas(docx, e.apprPos, e.apprName);

  const body = (children, o = {}) => p(children, { spacing: { before: 0, after: 0, line: 300 }, ...o });
  const labeled = (l, t) => body([run(l + " ", { bold: true, font: TNR }), run(t, { font: TNR })], { alignment: AlignmentType.JUSTIFIED, spacing: { before: 120 } });
  const checks = e.checks.flatMap((c) => [
    body([run(`Фискальный документ № ${c.fd} от ${c.date}, сумма ${rub(c.sum)}`, { font: TNR })], { indent: { left: 720 }, spacing: { before: 80 } }),
    ...c.items.map((t) => body([run(t, { font: TNR })], { indent: { left: 1080 } })),
  ]);

  // подписи: [метка] [должность] [подпись] [Ф.И.О.], под линиями — подсказки мелким шрифтом
  const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noB = { top: NB, bottom: NB, left: NB, right: NB };
  const SW = [2900, 2900, 200, 1500, 200, 2788];
  const sc = (i, children, b = noB, v = VerticalAlign.BOTTOM) => new TableCell({ width: { size: SW[i], type: WidthType.DXA }, borders: b, verticalAlign: v, margins: { left: 40, right: 40, top: 0, bottom: 0 }, children });
  const st = (t, o = {}) => p([run(t, { font: TNR, ...o })], { alignment: C });
  const sig = (label, pos, name) => new Table({
    columnWidths: SW, layout: TableLayoutType.FIXED, width: { size: SW.reduce((s, x) => s + x, 0), type: WidthType.DXA },
    borders: { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB },
    rows: [
      new TableRow({ cantSplit: true, height: { value: 560, rule: HeightRule.ATLEAST }, children: [
        sc(0, [p([run(label, { font: TNR })])]), sc(1, [st(pos)], { ...noB, bottom: line }), sc(2, [p([])]),
        sc(3, [p([])], { ...noB, bottom: line }), sc(4, [p([])]), sc(5, [st(name)], { ...noB, bottom: line })] }),
      new TableRow({ children: [sc(0, [p([])]), sc(1, [st("(должность)", { size: 16 })], noB, VerticalAlign.TOP), sc(2, [p([])]),
        sc(3, [st("(подпись)", { size: 16 })], noB, VerticalAlign.TOP), sc(4, [p([])]), sc(5, [st("(Ф.И.О.)", { size: 16 })], noB, VerticalAlign.TOP)] }),
    ],
  });
  const dateLine = "“__” _________ 20__ г.";

  return new Document({
    creator: "GearProduction",
    title: "Отчет о хозяйственных расходах",
    styles: { default: { document: { run: { font: TNR, size: 24 } } } },
    sections: [{
      // поля образца: левое 2 см, правое и верхнее 0,5 см
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 284, bottom: 700, left: 1134, right: 284 } } },
      children: [
        ...stamp,
        p([run("Отчет о хозяйственных расходах", { bold: true, font: TNR })], { alignment: C, spacing: { before: 480, after: 240 } }),
        labeled("Подразделение:", e.dept),
        labeled("Цель:", e.goal),
        body([run("Расходы:", { font: TNR })], { spacing: { before: 240 } }),
        ...checks,
        body([run(`Итого: ${rub(total)}`, { font: TNR, bold: true })], { spacing: { before: 240, after: 240 } }),
        sig("Ответственный:", e.respPos, e.respName),
        body([run(dateLine, { font: TNR })], { spacing: { before: 160, after: 360 } }),
        body([run(`Расходы подтверждаю, к оплате ${rub(total)}`, { font: TNR })], { spacing: { after: 160 } }),
        sig(dateLine, e.dirPos, e.dirName),
        p([run("", { size: 2 })], { spacing: { before: 0, after: 0, line: 20, lineRule: "exact" } }),
      ],
    }],
  });
}
// Отчёт о хозрасходах (бланк для АО: «Бланк_АО_по_хозяйственным_расходам.doc», пример — обеды сервис-инженеров):
// Tahoma 12, поля по 36 pt, таблица ФД без позиций, отметка руководителя, подтверждение к оплате.
// e: { dept, project, goal: [строки], checks: [{ fd, date, sum }], apprPos, apprName, respPos, respName, dateText }
function buildHoz(docx, e) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign, TableLayoutType, HeightRule } = docx;
  const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noB = { top: NB, bottom: NB, left: NB, right: NB };
  const run = (t, o = {}) => new TextRun({ text: String(t ?? ""), font: "Tahoma", size: 24, ...o });
  const p = (children, o = {}) => new Paragraph({ spacing: { before: 0, after: 0 }, children, ...o });
  const J = AlignmentType.JUSTIFIED, C = AlignmentType.CENTER;
  const u = { underline: {} };
  const total = checksTotal(e.checks);
  const field = (label, value) => p([run(label + " "), run(value || " ", u)], { alignment: J, spacing: { before: 120 } });
  const goal = e.goal.length ? e.goal : [""];

  const TW = [520, 5100, 2070, 1400, 1376]; // № · ФД № · Дата · Рублей · Копеек, в сумме ширина текста A4 с полями 36 pt
  const tcell = (i, t) => new TableCell({
    width: { size: TW[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { left: 80, right: 80, top: 30, bottom: 30 },
    children: [p([run(t, { size: 20 })], { alignment: i === 1 ? AlignmentType.LEFT : C })],
  });
  const trow = (arr) => new TableRow({ cantSplit: true, children: arr.map((t, i) => tcell(i, t)) });
  const table = new Table({
    columnWidths: TW, layout: TableLayoutType.FIXED, width: { size: 10466, type: WidthType.DXA },
    borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
    rows: [trow(["№", "ФД №", "Дата", "Рублей", "Копеек"]), ...e.checks.map((c, i) => {
      const k = Math.round((+c.sum || 0) * 100);
      return trow([String(i + 1), c.fd, c.date, String(Math.floor(k / 100)), String(k % 100).padStart(2, "0")]);
    })],
  });

  // строка подписи: ячейки с линией снизу и подписи под ними мелким шрифтом
  const sigTable = (SW, top, caps) => new Table({
    columnWidths: SW, layout: TableLayoutType.FIXED, width: { size: SW.reduce((s, x) => s + x, 0), type: WidthType.DXA },
    borders: { ...noB, insideHorizontal: NB, insideVertical: NB },
    rows: [
      new TableRow({ cantSplit: true, height: { value: 560, rule: HeightRule.ATLEAST }, children: top.map((c, i) => new TableCell({
        width: { size: SW[i], type: WidthType.DXA }, borders: c.line ? { ...noB, bottom: line } : noB, verticalAlign: VerticalAlign.BOTTOM,
        margins: { left: 40, right: 40, top: 0, bottom: 0 }, children: [p([run(c.t || "")], { alignment: c.al || C })] })) }),
      new TableRow({ children: caps.map((t, i) => new TableCell({
        width: { size: SW[i], type: WidthType.DXA }, borders: noB, verticalAlign: VerticalAlign.TOP,
        margins: { left: 40, right: 40, top: 0, bottom: 0 }, children: [p([run(t || "", { size: 16 })], { alignment: C })] })) }),
    ],
  });
  const ruled = () => p([run(" ")], { spacing: { before: 200 }, border: { bottom: line } });

  return new Document({
    creator: "GearProduction",
    title: "Отчет о хозяйственных расходах",
    styles: { default: { document: { run: { font: "Tahoma", size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        ...stampParas(docx, e.apprPos, e.apprName),
        p([run("Отчет о хозяйственных расходах", { bold: true })], { alignment: C, spacing: { before: 360, after: 120 } }),
        field("Подразделение:", e.dept),
        field("Проект:", e.project),
        p([run("Цель: "), run(goal[0] || " ", u)], { alignment: J, spacing: { before: 120 } }),
        ...goal.slice(1).map((t) => p([run(t, u)], { alignment: J })),
        p([run("Расходы:")], { spacing: { before: 120, after: 80 } }),
        table,
        p([run("Итого: "), run(rub(total), u)], { alignment: J, spacing: { before: 160 } }),
        p([run("Отметка руководителя о потраченных расходах")], { spacing: { before: 200 } }),
        ruled(), ruled(),
        p([run("Расходы подтверждаю, к оплате "), run(rub(total), u)], { spacing: { before: 240 } }),
        sigTable([2800, 2000, 200, 2700, 200, 2566], [{ t: "“__”_________ 20__ г.", al: AlignmentType.LEFT }, { line: 1 }, {}, { line: 1 }, {}, { line: 1 }],
          ["", "(подпись)", "", "(должность)", "", "(Ф.И.О.)"]),
        p([run("", { size: 12 })], { spacing: { before: 160 } }), // без абзаца Word сливает таблицы в одну
        sigTable([1900, 3100, 200, 2300, 200, 2766], [{ t: "Ответственный", al: AlignmentType.LEFT }, { t: e.respPos, line: 1 }, {}, { t: e.respName, line: 1 }, {}, { t: e.dateText }],
          ["", "(должность)", "", "(Ф.И.О.)", "", ""]),
        p([run("", { size: 2 })], { spacing: { before: 0, after: 0, line: 20, lineRule: "exact" } }),
      ],
    }],
  });
}
if (typeof module !== "undefined") module.exports = { buildDoc, buildExp, buildHoz, rub };
