"use strict";

(function () {
  const { index, runs } = window.DEMO_DATA;
  const model = window.DemoModel;
  const { TEXT } = model;
  const app = document.getElementById("app");
  const indexRunFiles = new Map();
  const docs = window.DOCS_DATA;
  const docsOverview = model.docsOverview(docs);
  const docsRoutes = new Map();
  function docsPath(question, config) {
    return "#/docs/" + encodeURIComponent(question) + "/" + encodeURIComponent(config);
  }
  for (const { id } of docs.questions) {
    for (const c of docs.configs) docsRoutes.set(docsPath(id, c.id), [id, c.id]);
  }

  const real = window.REAL_DATA;
  const realOverview = model.realOverview(real);
  const realRuns = new Map();

  function realPath(caseID, run) {
    return "#/real/" + encodeURIComponent(caseID) + "/" + run;
  }

  for (const item of real.cases) {
    for (const { run } of item.runs) realRuns.set(realPath(item.id, run), { caseID: item.id, run });
  }

  function scenarioPath(name) {
    return "#/s/" + encodeURIComponent(name);
  }

  function runPath(round, caseID, run) {
    return "#/run/" + [round, caseID, run].map(encodeURIComponent).join("/");
  }

  for (const scenario of index.scenarios) {
    for (const item of scenario.cases) {
      for (const ref of item.runs) indexRunFiles.set(runPath(ref.round, item.id, ref.run), ref.file);
    }
  }

  // 整个页面只用 DOM 节点和文字节点渲染记录。
  function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    for (const child of children) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function link(href, className, ...children) {
    const node = el("a", className, ...children);
    node.href = href;
    return node;
  }

  function badge(text, tone) {
    return el("span", "badge " + tone, text);
  }

  function verdictBadge(pass) {
    return badge(pass ? "✓ 通过" : "× 不通过", pass ? "ok" : "block");
  }

  function panel(title, ...children) {
    return el("section", "card", el("h2", "card-title", title), ...children);
  }

  function heading(title, ...children) {
    const h1 = el("h1", "", title);
    h1.tabIndex = -1;
    return el("header", "view-heading", h1, ...children);
  }

  function breadcrumbs(scenario) {
    const nav = el("nav", "breadcrumbs", link("#/", "", "总览"));
    nav.setAttribute("aria-label", "页面路径");
    if (scenario) nav.append(el("span", "separator", "/"), link(scenarioPath(scenario.name), "", scenario.title));
    return nav;
  }

  function facts(items, className) {
    return el("dl", className, ...items.map(([name, value]) =>
      el("div", "fact", el("dt", "", name), el("dd", "", value))));
  }

  function roundCard(round, grader) {
    const now = round.regraded;
    const card = el("article", "card round",
      el("h2", "", round.label),
      el("p", "muted", el("code", "", round.model), " · 推理强度 ", el("code", "", round.effort)),
      el("p", "score-label", "按 " + grader + " 重评"),
      el("div", "score",
        el("strong", "score-rate", now.rate),
        el("span", "score-count", `${now.passed}/${now.runs} 次通过`)),
      el("p", "case-score", `${now.casesAllPassed}/${now.cases} 个用例三次全过（${now.caseRate}）`));
    card.dataset.round = round.id;
    if (!round.sameGrader) {
      const was = round.recorded;
      card.append(el("p", "recorded",
        `当时按 ${round.recordedGrader} 评分，${was.passed}/${was.runs} 次通过（${was.rate}），${was.casesAllPassed}/${was.cases} 个用例三次全过（${was.caseRate}）`));
    }
    card.append(facts([["平均工具调用", round.meanToolCalls + " 次"], [TEXT.cost, round.estimatedUSD]], "round-facts"));
    const review = round.review;
    const reviewed = review.state === "reviewed";
    const note = el("div", "round-review", el("p", "", reviewed
      ? `第二轮有 ${now.runs} 次诊断。保存的复核记录中，${review.runsWithIssues} 次被标出解释问题。`
      : TEXT.reviewNone));
    card.append(note);
    return card;
  }

  function scenarioRow(scenario) {
    const anchor = link(scenarioPath(scenario.name), "scenario-title", scenario.title);
    const title = el("th", "scenario-name", anchor, el("span", "root-label", scenario.rootLabel));
    title.scope = "row";
    const row = el("tr", "scenario-row", title);
    row.dataset.scenario = scenario.name;
    row.addEventListener("click", (event) => {
      if (!event.target.closest("a")) anchor.click();
    });
    for (const cell of scenario.cells) {
      const count = badge(`${cell.passed}/${cell.runs}`, cell.allPassed ? "ok" : "warn");
      count.dataset.cell = cell.round;
      const td = el("td", "scenario-count", count);
      if (cell.passed !== cell.recordedPassed) {
        td.append(el("span", "recorded-count", `当时 ${cell.recordedPassed}/${cell.runs}`));
      }
      row.append(td);
    }
    return row;
  }

  function scenarioTable(view) {
    const labels = ["场景", ...view.rounds.map((round) => round.label)];
    const head = el("tr", "", ...labels.map((label) => {
      const th = el("th", "", label);
      th.scope = "col";
      return th;
    }));
    const table = el("table", "scenario-table", el("thead", "", head));
    const groups = new Map();
    for (const scenario of view.scenarios) {
      if (!groups.has(scenario.group)) {
        const label = el("th", "", scenario.group);
        label.colSpan = labels.length;
        label.scope = "rowgroup";
        const group = el("tbody", "", el("tr", "group-row", label));
        groups.set(scenario.group, group);
        table.append(group);
      }
      groups.get(scenario.group).append(scenarioRow(scenario));
    }
    return table;
  }

  function overviewPage(view) {
    const entry = link("#/real", "scenario-title", TEXT.realLink);
    entry.dataset.realLink = "";
    const docsEntry = link("#/docs", "scenario-title", TEXT.docsLink);
    docsEntry.dataset.docsLink = "";
    const totals = realOverview.totals;
    return [
      heading("诊断评测回放"),
      el("div", "real-entry", entry, el("p", "muted",
        `${totals.cases} 道题、${totals.runs} 次诊断，其中 ${totals.flagged} ${TEXT.realFlagged}`)),
      el("div", "real-entry", docsEntry, el("p", "muted",
        `${docsOverview.questions.length} 道题、${docsOverview.configs.length} 组设置。`)),
      el("div", "round-grid", ...view.rounds.map((round) => roundCard(round, view.graderVersion))),
      panel("场景对比", scenarioTable(view)),
    ];
  }

  function docsTable(labels, rows) {
    const headers = labels.map((name) => {
      const th = el("th", "", name);
      th.scope = "col";
      return th;
    });
    return el("table", "docs-table", el("thead", "", el("tr", "", ...headers)), el("tbody", "", ...rows));
  }

  function docsRow(title) {
    const th = el("th", "", title);
    th.scope = "row";
    return el("tr", "", th);
  }

  function docsPage(view) {
    const labels = ["设置", "段落数", "平均字数", "前 1 条", "前 3 条", "前 5 条", "前 5 条命中率"];
    const scores = view.configs.map((c) => {
      const row = docsRow(c.label);
      row.dataset.docsConfig = c.id;
      const values = [c.chunks, c.avgRunes, ...[c.hit1, c.hit3, c.hit5].map((n) => n + "/" + c.total), c.rate5];
      values.forEach((value, i) => {
        const cell = el("td", "docs-stat", value);
        cell.dataset.label = labels[i + 1];
        if (i === 4) cell.dataset.hit5 = "";
        row.append(cell);
      });
      return row;
    });
    const questions = view.questions.map((q) => {
      const row = docsRow(el("span", "", el("span", "case-id docs-id", q.id), q.question));
      row.dataset.docsQuestion = q.id;
      for (const [i, r] of q.ranks.entries()) {
        const anchor = link(docsPath(q.id, r.config), "docs-rank", r.label);
        anchor.setAttribute("aria-label", [q.id, view.configs[i].label, r.label].join("，"));
        const cell = el("td", "docs-rank-cell", anchor);
        cell.dataset.docsCell = r.config;
        cell.dataset.rank = r.rank;
        cell.dataset.label = view.configs[i].label;
        row.append(cell);
      }
      return row;
    });
    return [
      breadcrumbs(), heading("文档检索", el("p", "", TEXT.docsIntro)),
      panel("四组设置的检索成绩", el("p", "context-note", `语料快照共 ${view.files} 篇文档。`, TEXT.docsMetric),
        docsTable(labels, scores)),
      panel("怎么读这组数字", el("ol", "real-list", ...TEXT.docsFindings.map((text) => el("li", "", text)))),
      panel("逐题检索名次", docsTable(["问题", ...view.configs.map((c) => c.label)], questions)),
    ];
  }

  function docsQuestionPage(view) {
    const crumbs = breadcrumbs();
    crumbs.append(el("span", "separator", "/"), link("#/docs", "", "文档检索"), el("span", "separator", "/"), el("span", "", view.id));
    const nav = el("nav", "siblings");
    nav.setAttribute("aria-label", "切换检索设置");
    for (const s of view.siblings) {
      const item = link(docsPath(view.id, s.config), "sibling", s.label, el("strong", "", s.rank ? `第 ${s.rank} 名` : "未命中"));
      if (s.current) item.setAttribute("aria-current", "page");
      nav.append(item);
    }
    const gold = view.gold.map((p) => {
      const block = el("div", "docs-gold", el("code", "", p.location), el("pre", "raw", p.text));
      block.dataset.gold = p.location;
      return block;
    });
    const hits = view.hits.map((h) => {
      const p = h.passage;
      const title = el("h3", "step-heading", `第 ${h.n} 名 · ${p.heading || "无标题"}`, el("code", "", "分数 " + h.score));
      if (h.covers) title.append(badge(TEXT.docsCovers, "ok"));
      const result = el("pre", "raw", p.text);
      result.dataset.hitText = h.n;
      const toggle = resultToggle(result, "hit-text-" + h.n, "原文");
      toggle.dataset.hitToggle = h.n;
      const item = el("li", "step", title, el("code", "", p.location), el("div", "", toggle), result);
      item.dataset.hit = h.n;
      item.dataset.covers = h.covers;
      return item;
    });
    return [crumbs, nav, heading(view.title, el("p", "question", view.question), el("p", "docs-outcome", view.rankLabel)),
      panel("标准出处", ...gold), panel("前 5 条检索结果", el("ol", "step-list", ...hits))];
  }

  function realCaseRow(item) {
    const question = el("th", "", item.question, el("span", "root-label", "标准答案 · " + item.rootLabel));
    question.scope = "row";
    const row = el("tr", "", question);
    row.dataset.realCase = item.id;
    for (const run of item.runs) {
      const cell = link(realPath(item.id, run.run), "trial",
        el("strong", "trial-index", `第 ${run.run} 次`), verdictBadge(run.pass),
        el("span", "trial-answer", run.answeredLabel || "没有得出结论"));
      cell.dataset.realRun = item.id + "/" + run.run;
      cell.dataset.pass = run.pass;
      cell.dataset.flag = run.flagged;
      if (run.flagged) {
        const flag = badge("未查到的引用", "warn");
        flag.title = TEXT.realUnseen;
        flag.setAttribute("aria-label", TEXT.realUnseen);
        cell.append(flag);
      }
      row.append(el("td", "", cell));
    }
    return row;
  }

  function realPage(view) {
    const { source, totals, check } = view;
    const { counts } = source;
    const list = (items) => el("ol", "real-list", ...items.map((text) => el("li", "", text)));
    return [
      breadcrumbs(), heading("实战案例", el("p", "", TEXT.realIntro)),
      panel("数据来源", facts([
        ["系统", source.system], ["实例", source.instance], ["版本", source.release], ["导出时间", source.exportedAt],
        ["范围", source.range], ["资金", source.fundsLabel],
        ["记录", `${counts.commands} 条命令、${counts.events} 个事件、${counts.postings} 行记账、${counts.orders} 张订单`],
      ], "usage"), el("p", "source-note", source.rangeNote), el("p", "muted", view.units),
      el("p", "source-note", badge(check.label, check.ok ? "ok" : "warn"), " ", TEXT.realCheck)),
      panel("这段记录里发生了什么", list(TEXT.realStory)),
      panel("评测成绩", el("div", "score", el("strong", "score-rate", totals.rate),
        el("span", "score-count", `${totals.passed}/${totals.runs} 次通过`)),
      el("p", "", `按旧规则，${totals.passed} 次通过。其中 ${totals.flagged} 次引用了本次没查到的事件编号。`),
      facts([["模型", view.model], ["思考强度", view.effort], ["评分版本", view.graderVersion], [TEXT.cost, totals.cost]], "real-score-facts usage"),
      el("p", "context-note", TEXT.realCaveat)),
      panel("题目与试验", el("table", "real-cases", el("tbody", "", ...view.cases.map(realCaseRow)))),
      panel("评分没有发现的问题", list(TEXT.realFindings), el("p", "source-note muted", TEXT.realSource)),
    ];
  }

  function caseRun(caseID, run) {
    const card = link(runPath(run.round, caseID, run.run), "trial",
      el("span", "trial-round", run.roundLabel),
      el("strong", "trial-index", `第 ${run.run} 次`),
      verdictBadge(run.pass),
      el("span", "trial-answer", run.answeredLabel || "没有得出结论"));
    card.dataset.run = [run.round, caseID, run.run].join("/");
    card.dataset.pass = run.pass;
    if (run.changed) card.append(badge("重评有变化", "accent"));
    if (run.issues > 0) card.append(badge(`审读 ${run.issues} 项`, "warn"));
    return card;
  }

  function scenarioPage(view) {
    return [
      breadcrumbs(),
      heading(view.title, el("p", "muted", "标准根因 ", el("strong", "", view.rootLabel))),
      ...view.cases.map((item) => el("article", "card case",
        el("h2", "case-id", item.id),
        el("p", "question", item.question),
        el("div", "trial-grid", ...item.runs.map((run) => caseRun(item.id, run))))),
    ];
  }

  function verdictPanel(view) {
    const { verdict, answer, expected, status } = view;
    const card = el("section", "card verdict " + (verdict.pass ? "passed" : "failed"),
      el("h2", "verdict-label", verdict.pass ? "✓ " + verdict.label : "× " + verdict.label));
    card.dataset.verdict = verdict.pass ? "pass" : "fail";
    if (verdict.note) card.append(el("p", "recorded verdict-note", verdict.note));
    card.append(facts([
      ["模型判断", answer?.rootLabel ?? status.label],
      ["标准根因", expected.rootLabel],
    ], "root-comparison"));
    if (view.unseen) {
      for (const group of expected.mustCite) card.append(el("p", "muted", `标准答案认可：${group.join("、")}（任选一个）`));
      if (expected.onlyCite.length) card.append(el("p", "muted", "只能引用：" + expected.onlyCite.join("、")));
      if (expected.noCitable) card.append(el("p", "muted", "这道题没有事件可以引用"));
    }
    if (answer) {
      card.append(el("p", "conclusion", answer.conclusion),
        el("p", "muted confidence", "置信度 ", el("strong", "", answer.confidenceLabel)));
      if (answer.notFound.length) {
        card.append(el("h3", "subheading", "未找到"),
          el("ul", "not-found", ...answer.notFound.map((text) => el("li", "", text))));
      }
    } else if (status.reason) {
      card.append(el("p", "muted", el("code", "", status.reason)));
    }
    return card;
  }

  function checksPanel(checks) {
    const list = el("ul", "check-list");
    for (const check of checks) {
      const item = el("li", "check-item",
        el("div", "check-heading", verdictBadge(check.ok), el("strong", "", check.label)));
      item.dataset.check = check.key;
      item.dataset.ok = check.ok;
      if (check.changed) {
        item.firstElementChild.append(badge("当时判为" + (check.recordedOk ? "通过" : "不通过"), "accent"));
      }
      if (check.detail) item.append(el("p", "check-detail muted", check.detail));
      list.append(item);
    }
    return panel("评分检查", list);
  }

  function eventsPanel(events) {
    if (events.length === 0) return panel("证据事件", el("p", "muted", "没有证据事件"));
    const headers = ["序号", "类型", "内容", "标记"].map((label) => {
      const th = el("th", "", label);
      th.scope = "col";
      return th;
    });
    const body = el("tbody", "");
    for (const event of events) {
      const tags = el("div", "tags", ...event.tags.map((tag) => badge(tag, tag === "模型引用" ? "accent" : "neutral")));
      const seq = el("th", "mono", event.seq);
      seq.scope = "row";
      const row = el("tr", "", seq, el("td", "", event.kindLabel),
        el("td", "event-text", event.text), el("td", "", tags));
      row.dataset.event = event.seq;
      body.append(row);
      if (event.untrustedKind === "text") {
        const warning = el("td", "untrusted",
          el("strong", "", TEXT.untrusted), el("pre", "raw", event.untrusted));
        warning.colSpan = headers.length;
        body.append(el("tr", "", warning));
      } else if (event.untrustedKind === "code") {
        row.querySelector(".event-text").append(el("small", "client-code", TEXT.clientCode + " ", el("code", "", event.untrusted)));
      }
    }
    return panel("证据事件", el("table", "event-table", el("thead", "", el("tr", "", ...headers)), body));
  }

  function resultToggle(result, id, label) {
    result.id = id;
    result.hidden = true;
    const toggle = el("button", "step-toggle", "展开" + label);
    toggle.type = "button";
    toggle.setAttribute("aria-controls", id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      result.hidden = !result.hidden;
      toggle.setAttribute("aria-expanded", String(!result.hidden));
      toggle.textContent = (result.hidden ? "展开" : "收起") + label;
    });
    return toggle;
  }

  function stepItem(step) {
    const result = el("pre", "raw", step.content);
    result.dataset.stepResult = step.n;
    const toggle = resultToggle(result, "step-result-" + step.n, "结果");
    toggle.dataset.stepToggle = step.n;
    const title = el("h3", "step-heading", `第 ${step.n} 步 · ${step.toolLabel}`, el("code", "", step.tool));
    if (step.isError) title.append(badge("工具出错", "block"));
    const item = el("li", "step",
      title, el("p", "step-label", "输入"), el("pre", "raw", step.input), toggle, result);
    item.dataset.step = step.n;
    return item;
  }

  function stepsPanel(steps) {
    return panel("工具调用", el("p", "context-note", TEXT.scope),
      steps.length ? el("ol", "step-list", ...steps.map(stepItem)) : el("p", "muted", "没有工具调用"));
  }

  function reviewPanel(review) {
    const text = { none: TEXT.reviewNone, clean: TEXT.reviewClean, issues: TEXT.reviewIssues }[review.state];
    const card = panel("解释复核");
    card.append(el("p", "", text));
    if (review.state === "issues") {
      card.append(el("ul", "issue-list", ...review.issues.map(({ type, quote }) =>
        el("li", "", badge(type, "warn"), el("blockquote", "", quote)))));
    }
    return card;
  }

  function siblingNav(siblings, caseID) {
    const nav = el("nav", "siblings");
    nav.setAttribute("aria-label", "切换同一用例的试验");
    for (const run of siblings) {
      const href = run.round ? runPath(run.round, caseID, run.run) : realPath(caseID, run.run);
      const prefix = run.round ? run.roundLabel + " · " : "";
      const item = link(href, "sibling",
        el("span", run.pass ? "pass-icon" : "fail-icon", run.pass ? "✓" : "×"),
        `${prefix}第 ${run.run} 次`);
      item.setAttribute("aria-label", `${item.textContent}，${run.pass ? "通过" : "不通过"}`);
      if (run.current) item.setAttribute("aria-current", "page");
      nav.append(item);
    }
    return nav;
  }

  function runPage(view, caseID) {
    const meta = view.meta;
    const crumbs = breadcrumbs(view.scenario);
    const switcher = siblingNav(view.siblings, caseID);
    const title = heading(view.title, el("p", "question", view.question));
    const nodes = [crumbs];
    if (view.unseen) {
      crumbs.append(el("span", "separator", "/"), link("#/real", "", "实战案例"), el("span", "separator", "/"), el("span", "", caseID));
      nodes.push(switcher, title);
    } else {
      nodes.push(title, switcher);
    }
    nodes.push(verdictPanel(view), checksPanel(view.checks));
    if (view.unseen?.note) {
      const note = panel(TEXT.realUnseen, el("p", "", view.unseen.note));
      note.dataset.unseen = view.unseen.seqs.length;
      nodes.push(note);
    }
    nodes.push(eventsPanel(view.events), stepsPanel(view.steps));
    if (view.review) nodes.push(reviewPanel(view.review));
    nodes.push(
      panel("用量", facts([
        ["工具调用", meta.toolCalls + " 次"],
        ["对话轮数", meta.turns + " 轮"],
        ["耗时", meta.elapsed],
        [TEXT.cost, meta.cost],
        ["输入 token", meta.inputTokens],
        ["输出 token", meta.outputTokens],
        ["缓存读取 token", meta.cacheReadTokens],
      ], "usage")),
    );
    return nodes;
  }

  function render(focus) {
    const hash = window.location.hash;
    let view = "notfound";
    let nodes = [heading("没有这个页面", link("#/", "", "回总览"))];
    if (hash === "" || hash === "#/") {
      view = "overview";
      nodes = overviewPage(model.overview(index));
    } else if (hash === "#/docs") {
      view = "docs";
      nodes = docsPage(docsOverview);
    } else if (docsRoutes.has(hash)) {
      view = "docsq";
      nodes = docsQuestionPage(model.docsQuestionView(docs, ...docsRoutes.get(hash)));
    } else if (hash === "#/real") {
      view = "real";
      nodes = realPage(realOverview);
    } else if (realRuns.has(hash)) {
      const { caseID, run } = realRuns.get(hash);
      view = "realrun";
      nodes = runPage(model.realRunView(real, caseID, run), caseID);
    } else if (hash.startsWith("#/s/")) {
      const scenario = index.scenarios.find((item) => scenarioPath(item.name) === hash);
      if (scenario) {
        view = "scenario";
        nodes = scenarioPage(model.scenarioView(index, scenario.name));
      }
    } else {
      const file = indexRunFiles.get(hash);
      if (file && Object.hasOwn(runs, file)) {
        const run = runs[file];
        view = "run";
        nodes = runPage(model.runView(index, run), run.case_id);
      }
    }
    app.replaceChildren(...nodes);
    document.getElementById("banner").textContent = ({ real: TEXT.realBanner, realrun: TEXT.realBanner, docs: TEXT.docsBanner, docsq: TEXT.docsBanner })[view] ?? TEXT.banner;
    app.dataset.view = view;
    app.dataset.route = hash;
    const title = app.querySelector("h1");
    document.title = title.textContent + " · mini-exchange";
    if (focus) {
      window.scrollTo(0, 0);
      title.focus({ preventScroll: true });
    }
  }

  document.getElementById("skip").addEventListener("click", (event) => {
    event.preventDefault();
    app.focus();
  });
  window.addEventListener("hashchange", () => render(true));
  render(false);
})();
