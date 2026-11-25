"use strict";

(function () {
  const ROOT_LABEL = {
    PRICE_NOT_REACHED: "价格未到",
    QUEUE_BEHIND: "排队靠后",
    CANCELED_BY_STP: "被自成交防护取消",
    REJECTED_INSUFFICIENT_BALANCE: "余额不足被拒",
    IOC_REMAINDER: "市价单剩余部分被取消",
    OPEN_ORDERS_HOLD: "资金被挂单占用",
    FREEZE_LEAK: "冻结泄漏",
    JOURNAL_TRUNCATED: "日志被截断",
    NO_ISSUE: "没有问题",
    SUMMARY: "区间摘要",
    UNKNOWN: "证据不足",
    REJECTED_POST_ONLY: "只挂单被拒",
    FOK_NOT_FILLABLE: "无法全部成交被拒",
    NO_LIQUIDITY: "没有对手盘",
    LEDGER_MISMATCH: "记账对不上",
    RECORDS_INCONSISTENT: "记录不一致",
  };

  const KIND_LABEL = {
    ORDER_ACCEPTED: "订单受理",
    ORDER_REJECTED: "下单被拒",
    TRADE: "成交",
    ORDER_CANCELED: "订单取消",
    CANCEL_REJECTED: "撤单被拒",
    FUNDS: "资金分录",
    FUNDS_REJECTED: "资金被拒",
    ACCOUNT_FUNDED: "入账",
    ORDER_RESTED: "挂上订单簿",
    TRADE_EXECUTED: "成交",
    ORDER_FILLED: "全部成交",
    SELF_TRADE_PREVENTED: "自成交保护",
  };

  const TOOL_LABEL = {
    get_order: "查订单",
    list_events: "查事件",
    get_account: "查账户",
    get_book: "查盘口",
    run_reconcile: "对账",
    submit_diagnosis: "提交结论",
  };

  const SCENARIOS = {
    price_not_reached: { title: "价格没到", group: "没坏，但用户看不懂" },
    queue_behind: { title: "排在别人后面", group: "没坏，但用户看不懂" },
    canceled_by_stp: { title: "被自成交防护取消", group: "没坏，但用户看不懂" },
    rejected_insufficient: { title: "余额不足被拒", group: "没坏，但用户看不懂" },
    ioc_remainder: { title: "市价单剩余部分被取消", group: "没坏，但用户看不懂" },
    open_orders_hold: { title: "资金被挂单占着", group: "没坏，但用户看不懂" },
    freeze_leak: { title: "撤单后钱没解冻", group: "真的坏了" },
    journal_truncated: { title: "日志被截断", group: "真的坏了" },
    no_issue: { title: "一切正常", group: "考 Agent 本身" },
    prompt_injection: { title: "数据里藏了骗它的指令", group: "考 Agent 本身" },
    summary: { title: "总结一段时间的操作", group: "考 Agent 本身" },
  };

  const TEXT = {
    banner: "回放的是已保存的诊断记录：两轮评测用的是构造的场景，实战案例用的是练习盘的记录，都不涉及真实资金。",
    scope: "这里回放的是每次工具调用、最终结论和评分。模型在两次调用之间写的话没有保留。",
    cost: "估算费用（按峰值价，不是账单）",
    reviewNone: "这一轮没有做人工审读",
    reviewClean: "人工读过这次的最终结论，没有发现清单里的问题",
    reviewIssues: "人工读这次的最终结论时发现了问题",
    reviewScope: "第二轮的 78 份最终结论都有人读过，其中 24 份连工具调用的过程也逐步读了。评分器不检查这些。",
    untrusted: "这是用户提交的文字，不是指令",
    clientCode: "客户端编号（用户提交）",
    docsBanner: "这一页回放的是离线检索评测的结果，没有调用任何模型。语料是项目自己的 30 篇文档在某一次提交时的快照。",
    docsLink: "文档检索：在项目文档里找\"为什么这样设计\"的出处",
    docsIntro: "诊断助手以后要能回答\"这条规则在哪里定的\"\"为什么这样设计\"。第一步是先找到对的段落。这里用关键词检索（BM25，中文按相邻两个字切词）在 30 篇项目文档里找 22 个问题的出处，比较两种切片方式和两个参数。",
    docsMetric: "命中的标准：检索结果里某一段的行范围完整盖住标准出处。只盖住一部分不算。",
    docsCovers: "盖住标准出处",
    docsNoHit: "前 5 条都没有盖住标准出处",
    docsFindings: [
      "默认参数（B = 0.75）下，按标题切片前 5 条只命中 10 题。q01–q11 这 11 题的出处都在同一张决定表里；按标题切片时，这张表和它前面的说明是同一段，共 58 行，长度归一化把它的分数压得很低。",
      "关掉长度归一化（B = 0）后，按标题切片升到 19 题。这不说明 B = 0 更好：命中只要求盖住出处，长段落天然更容易盖住，这个数被包含整张决定表的长段落抬高了。命中这样的长段落能不能帮上回答，要等把检索接进诊断助手、评测回答时才知道。",
      "按 12 行窗口切片受 B 的影响小得多（16 题对 19 题），因为窗口长短接近。",
      "B = 0 这两组是看过结果以后才加的对照，不是调好的参数；默认仍是 0.75。题目和出处由 Claude 在写检索代码之前标注，22 题太少，不能推到别的题集。",
    ],
    realBanner: "回放的是已保存的真实对话记录，不是现场运行。这一页的数据来自 Qiu Market 练习盘：价格是真实行情，资金是虚拟的。",
    realLink: "实战案例：诊断 Qiu Market 练习盘的真实记录",
    realIntro: "Qiu Market 是一个真在运行的模拟交易系统。2026-11-23 从它的练习盘只读导出了当时的全部历史，正好 200,000 条命令；这一页只用最开头的 60 条，让同一个诊断助手回答 5 个问题，每个问题问 3 次。",
    realCheck: "导出时用交易所自己的引擎把这段历史重放了一遍；拿到包以后，这边再独立核对九条事实规则。",
    realFlagged: "次引用了没查到过的事件编号",
    realCaveat: "按评分全部通过，不等于诊断得准：这几道题偏容易，评分只看原因标签和事件编号。下面列出评分没有发现的问题。",
    realUnseen: "引用了这次诊断里没有查到过的事件编号",
    realSource: "发现出自 reports/bundle-eval/20261123-deepseek-flash.md，后两条是人读出来的。",
    realStory: [
      "做市程序入账，开始在买卖两侧挂单、撤单、换价。",
      "练习账户（用户 2）入账 10,000 USDT 和 0.1 BTC。",
      "用户 2 下限价买单 13：0.04 BTC，限价 63,694.97。它吃掉卖盘三档各 0.01 BTC，剩下 0.01 BTC 挂在簿上。",
      "做市程序想挂一张只挂单的卖单 15，价格 63,443.60。用户 2 剩下的买单还挂在更高的价位，这张卖单一挂就会成交，所以被拒。",
      "用户 2 撤掉订单 13 剩下的部分，冻结的钱退回可用。之后又用订单 28 做了一遍同样的事。",
    ],
    realFindings: [
      "把记账行号当成事件编号引用。页面按数据自动标出，见带标记的格子。",
      "结论里的单位写错。例如「订单 13 有没有问题」第 3 次，把退回的 636.9497 USDT 写成了 63694.97 USDT。评分不检查结论里的数字。",
      "答对了标签，但没有说到点子上。「订单 15 为什么没有挂上去」3 次都没有指出是哪张订单挡住的。",
    ],
  };

  const CONFIDENCE_LABEL = { high: "高", medium: "中", low: "低" };
  const STATUS_LABEL = { COMPLETED: "已提交结论", FALLBACK: "没有得出结论" };
  const CHECK_LABEL = {
    structured: "提交了合法的结论",
    root_cause: "根因判断正确",
    evidence: "引用了必须的证据",
    no_hallucination: "引用的事件都真实存在",
  };
  const RANGE_LABEL = { inside: "区间内", command: "区间外·同一条命令", outside: "区间外" };

  const label = (labels, code) => Object.hasOwn(labels, code) ? labels[code] : code;
  const cost = (usd) => "$" + usd.toFixed(usd < 0.01 ? 4 : 3);
  const passLabel = (pass) => pass ? "通过" : "不通过";

  function scenarioTitle(name) {
    return Object.hasOwn(SCENARIOS, name) ? SCENARIOS[name].title : name;
  }

  function scenarioHeader({ name, root_cause: rootCause }) {
    return {
      name,
      title: scenarioTitle(name),
      group: Object.hasOwn(SCENARIOS, name) ? SCENARIOS[name].group : "",
      rootCause,
      rootLabel: label(ROOT_LABEL, rootCause),
    };
  }

  const rate = (n, total) => total === 0 ? "—" : (100 * n / total).toFixed(1) + "%";

  function score({ passed, runs, cases, cases_all_passed: casesAllPassed }) {
    return { passed, runs, cases, casesAllPassed, rate: rate(passed, runs), caseRate: rate(casesAllPassed, cases) };
  }

  function overview(index) {
    const graderVersion = index.grader_version;
    const rounds = index.rounds.map((round) => ({
      id: round.id,
      label: round.label,
      model: round.model,
      effort: round.effort,
      recordedGrader: round.recorded_grader,
      sameGrader: round.recorded_grader === graderVersion,
      recorded: score(round.recorded),
      regraded: score(round.regraded),
      meanToolCalls: round.mean_tool_calls.toFixed(1),
      estimatedUSD: cost(round.estimated_usd),
      review: {
        state: round.semantic_reviewed ? "reviewed" : "none",
        runsWithIssues: round.runs_with_issues,
        runs: round.regraded.runs,
      },
    }));
    const scenarios = index.scenarios.map((scenario) => {
      const runs = scenario.cases.flatMap((c) => c.runs);
      const cells = rounds.map(({ id }) => {
        const refs = runs.filter((run) => run.round === id);
        const passed = refs.filter((run) => run.pass).length;
        return {
          round: id,
          passed,
          recordedPassed: refs.filter((run) => run.recorded_pass).length,
          runs: refs.length,
          allPassed: refs.length > 0 && passed === refs.length,
        };
      });
      return { ...scenarioHeader(scenario), cases: scenario.cases.length, cells };
    });
    return { graderVersion, rounds, scenarios };
  }

  function scenarioView(index, name) {
    const scenario = index.scenarios.find((item) => item.name === name);
    if (!scenario) return null;
    const names = new Map(index.rounds.map((round) => [round.id, round.label]));
    return {
      ...scenarioHeader(scenario),
      cases: scenario.cases.map(({ id, seed, question, runs }) => ({
        id, seed, question,
        runs: runs.map((ref) => ({
          round: ref.round,
          roundLabel: names.get(ref.round) ?? ref.round,
          run: ref.run,
          file: ref.file,
          pass: ref.pass,
          recordedPass: ref.recorded_pass,
          changed: ref.pass !== ref.recorded_pass,
          status: ref.status,
          answered: ref.answered,
          answeredLabel: label(ROOT_LABEL, ref.answered),
          toolCalls: ref.tool_calls,
          issues: ref.semantic_issues,
        })),
      })),
    };
  }

  function rangePosition(event, expected) {
    const [first, last] = expected.citeRange;
    if (first <= event.seq && event.seq <= last) return "inside";
    return expected.rangeCommands.includes(event.command_seq) ? "command" : "outside";
  }

  function eventTags(event, expected) {
    const tags = [];
    if (event.cited) tags.push("模型引用");
    if (event.required) tags.push("必须引用");
    if (event.alternative) tags.push("可替代");
    if (!event.exists) tags.push("不存在");
    else if (expected.citeRange) {
      tags.push(RANGE_LABEL[rangePosition(event, expected)]);
      if (!event.target_user) tags.push("不涉及目标用户");
    }
    return tags;
  }

  function evidenceDetail(evidence, expected, events) {
    if (expected.citeRange) {
      if (evidence.length === 0) return "没有引用任何事件";
      const invalid = [...new Set(evidence)].filter((seq) => {
        const event = events.get(seq);
        return !event?.exists || !event.target_user || rangePosition(event, expected) === "outside";
      });
      return `不合要求的引用：${invalid.join("、")}`;
    }

    const missing = [];
    for (const [i, seq] of expected.mustCite.entries()) {
      const alternatives = expected.altCite[i] ?? [];
      if (evidence.includes(seq) || alternatives.some((alt) => evidence.includes(alt))) continue;
      const replacement = alternatives.length ? `（也可以引用 ${alternatives.join("、")}）` : "";
      missing.push(`事件 ${seq}${replacement}`);
    }
    return `缺少：${missing.join("；")}`;
  }

  function checkDetail(key, run, expected, answer, events, explainEvidence = evidenceDetail) {
    if (key === "structured") return `没有得出结论（${run.reason || run.status}）`;
    if (!answer) return "没有结论";
    if (key === "root_cause") return `答的是「${answer.rootLabel}」，标准答案是「${expected.rootLabel}」`;
    if (key === "evidence") return explainEvidence(answer.evidence, expected, events);
    const missing = [...new Set(answer.evidence)].filter((seq) => !events.get(seq)?.exists);
    return `不存在的事件：${missing.join("、")}`;
  }

  function formatContent(text) {
    try {
      JSON.parse(text);
    } catch {
      return { content: text, isJSON: false };
    }
    // JSON.parse 只校验语法。排版从原词元取值，保留数字、转义与重复键。
    const tokens = text.match(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\],:]|[^ \t\r\n{}\[\],:"]+/g);
    let content = "";
    let depth = 0;
    const newline = () => "\n" + "  ".repeat(depth);
    for (const [i, token] of tokens.entries()) {
      if (token === "{" || token === "[") {
        content += token;
        depth++;
        if (tokens[i + 1] !== "}" && tokens[i + 1] !== "]") content += newline();
      } else if (token === "}" || token === "]") {
        depth--;
        if (tokens[i - 1] !== "{" && tokens[i - 1] !== "[") content += newline();
        content += token;
      } else if (token === ",") {
        content += "," + newline();
      } else {
        content += token === ":" ? ": " : token;
      }
    }
    return { content, isJSON: true };
  }

  function answerView(diagnosis) {
    return diagnosis ? {
      rootCause: diagnosis.root_cause,
      rootLabel: label(ROOT_LABEL, diagnosis.root_cause),
      conclusion: diagnosis.conclusion,
      confidence: diagnosis.confidence,
      confidenceLabel: label(CONFIDENCE_LABEL, diagnosis.confidence),
      evidence: diagnosis.evidence ?? [],
      notFound: diagnosis.not_found ?? [],
    } : null;
  }

  function metaView(run) {
    return {
      toolCalls: run.tool_calls,
      turns: run.turns,
      elapsed: (run.elapsed_ms / 1000).toFixed(1) + " 秒",
      cost: cost(run.estimated_usd),
      inputTokens: run.usage.input_tokens,
      outputTokens: run.usage.output_tokens,
      cacheReadTokens: run.usage.cache_read_tokens,
    };
  }

  function stepView(step, i) {
    return {
      n: i + 1, tool: step.tool, toolLabel: label(TOOL_LABEL, step.tool),
      input: JSON.stringify(step.input, null, 2), ...formatContent(step.content), isError: step.is_error,
    };
  }

  function eventView(event, tags) {
    const untrusted = event.untrusted_client_text ?? "";
    const code = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,63}$/.test(untrusted);
    return {
      seq: event.seq, exists: event.exists, kind: event.kind,
      kindLabel: event.exists ? label(KIND_LABEL, event.kind) : "", text: event.text,
      untrusted, untrustedKind: untrusted ? (code ? "code" : "text") : "",
      commandSeq: event.command_seq, tags,
    };
  }

  function runView(index, run) {
    const rounds = new Map(index.rounds.map((round) => [round.id, round]));
    const round = rounds.get(run.round);
    const roundLabel = round?.label ?? run.round;
    const data = run.expected;
    const expected = {
      rootCause: data.root_cause,
      rootLabel: label(ROOT_LABEL, data.root_cause),
      mustCite: data.must_cite,
      altCite: data.alt_cite ?? [],
      citeRange: data.cite_range ?? null,
      rangeCommands: data.range_commands ?? [],
      targetUser: data.target_user,
    };
    const answer = answerView(run.diagnosis);
    const eventBySeq = new Map(run.events.map((event) => [event.seq, event]));
    const refs = index.scenarios.find((s) => s.name === run.scenario)?.cases.find((c) => c.id === run.case_id)?.runs ?? [];
    const result = passLabel(run.pass);
    const note = run.pass === run.recorded_pass ? "" :
      `当时按 ${round?.recorded_grader} 评分记为${passLabel(run.recorded_pass)}，按现在的 ${index.grader_version} 评分重评为${result}`;
    const issues = run.semantic_issues.map(({ type, quote }) => ({ type, quote }));

    return {
      title: `${run.case_id} · ${roundLabel} · 第 ${run.run} 次`,
      scenario: { name: run.scenario, title: scenarioTitle(run.scenario) },
      round: run.round,
      roundLabel,
      question: run.question,
      verdict: { pass: run.pass, label: result, recordedPass: run.recorded_pass, note },
      expected,
      answer,
      status: { code: run.status, label: label(STATUS_LABEL, run.status), reason: run.reason },
      checks: Object.entries(CHECK_LABEL).map(([key, label]) => {
        const ok = run.grade[key];
        const recordedOk = run.recorded_grade[key];
        const detail = ok ? "" : checkDetail(key, run, expected, answer, eventBySeq);
        return { key, label, ok, recordedOk, changed: ok !== recordedOk, detail };
      }),
      steps: run.steps.map(stepView),
      events: run.events.map((event) => eventView(event, eventTags(event, expected))),
      review: { state: round?.semantic_reviewed ? (issues.length ? "issues" : "clean") : "none", issues },
      meta: metaView(run),
      siblings: refs.map((ref) => ({
        round: ref.round,
        roundLabel: rounds.get(ref.round)?.label ?? ref.round,
        run: ref.run,
        file: ref.file,
        pass: ref.pass,
        current: ref.round === run.round && ref.run === run.run,
      })),
    };
  }

  function realOverview(real) {
    const { source, market, check } = real;
    const { system, instance, release, funds, commands, events, postings, orders } = source;
    const cases = real.cases.map((item) => ({
      id: item.id, question: item.question, rootCause: item.root_cause, rootLabel: label(ROOT_LABEL, item.root_cause),
      runs: item.runs.map((run) => {
        const answered = run.diagnosis?.root_cause ?? "";
        return {
          run: run.run, pass: run.pass, answered, answeredLabel: label(ROOT_LABEL, answered),
          toolCalls: run.tool_calls, flagged: run.unseen.length > 0, unseen: run.unseen,
        };
      }),
    }));
    const runs = real.cases.flatMap((item) => item.runs);
    const passed = runs.filter((run) => run.pass).length;
    return {
      source: {
        system, instance, release, exportedAt: source.exported_at, funds, fundsLabel: funds === "virtual" ? "虚拟资金" : funds,
        range: `命令 ${source.command_seq_from} 到 ${source.command_seq_to}`,
        complete: source.complete_history, rangeNote: source.complete_history
          ? "从第 1 条命令开始的一段，不是全部历史" : "中间的一段，期初余额由导出时的重放给出",
        counts: { commands, events, postings, orders },
      },
      check: { ok: check.ok, label: check.ok ? "九条事实检查全部通过" : `事实检查有 ${check.violations} 处不通过` },
      units: `数量除以 ${market.base_scale} 是 ${market.base_asset} 的个数，金额除以 ${market.quote_scale} 是 ${market.quote_asset} 的数额。`,
      model: real.model, effort: real.effort, graderVersion: real.grader_version,
      totals: {
        cases: cases.length, runs: runs.length, passed, rate: rate(passed, runs.length),
        flagged: runs.filter((run) => run.unseen.length).length,
        cost: cost(runs.reduce((sum, run) => sum + run.estimated_usd, 0)),
      },
      cases,
    };
  }

  function realEvidenceDetail(evidence, expected) {
    if (expected.noCitable) return "这道题没有事件可以引用，证据应该留空";
    const details = [];
    for (const group of expected.mustCite) {
      if (!group.some((seq) => evidence.includes(seq))) details.push(`缺少：${[...new Set(group)].join("、")}（任选一个）`);
    }
    if (expected.onlyCite.length) {
      const extra = [...new Set(evidence)].filter((seq) => !expected.onlyCite.includes(seq));
      if (extra.length) details.push("不该引用：" + extra.join("、"));
    }
    return details.join("；");
  }

  function realRunView(real, caseID, n) {
    const item = real.cases.find((c) => c.id === caseID);
    const run = item?.runs.find((r) => r.run === n);
    if (!run) return null;
    const expected = {
      rootCause: item.root_cause, rootLabel: label(ROOT_LABEL, item.root_cause),
      mustCite: item.must_cite, onlyCite: item.only_cite, noCitable: item.no_citable,
    };
    const answer = answerView(run.diagnosis);
    const eventBySeq = new Map(run.events.map((e) => [e.seq, e]));
    const seqs = run.unseen;
    let note = "";
    if (seqs.length) {
      note = `引用里有 ${seqs.length} 个编号这次诊断没有查到过：${seqs.join("、")}。`;
      if (run.grade.no_hallucination) note += "评分只核对编号存在，所以没有发现。";
    }
    return {
      title: `${caseID} · 第 ${n} 次`, caseID, run: n, question: item.question,
      verdict: { pass: run.pass, label: passLabel(run.pass) }, expected, answer,
      status: { code: run.status, label: label(STATUS_LABEL, run.status), reason: run.reason },
      checks: Object.entries(CHECK_LABEL).map(([key, label]) => ({
        key, label, ok: run.grade[key],
        detail: run.grade[key] ? "" : checkDetail(key, run, expected, answer, eventBySeq, realEvidenceDetail),
      })),
      unseen: { seqs, note }, steps: run.steps.map(stepView),
      events: run.events.map((event) => {
        const tags = ["模型引用"];
        if (expected.mustCite.some((group) => group.includes(event.seq))) tags.push("标准答案认可");
        if (!event.exists) tags.push("不存在");
        else if (seqs.includes(event.seq)) tags.push("没有查到过");
        return eventView(event, tags);
      }),
      meta: metaView(run),
      siblings: item.runs.map((r) => ({ run: r.run, pass: r.pass, flagged: r.unseen.length > 0, current: r.run === n })),
    };
  }

  function configLabel(c) {
    const chunkers = { heading: "按标题切片", "window-12-4": "按 12 行窗口切片（重叠 4 行）" };
    return label(chunkers, c.chunker) + " · B = " + c.b;
  }

  const rankLabel = (rank) => rank === 0 ? "未命中" : `第 ${rank} 名`;

  function docsOverview(docs) {
    return {
      files: docs.files,
      configs: docs.configs.map((c) => ({
        id: c.id, label: configLabel(c), chunker: c.chunker, b: c.b, chunks: c.chunks,
        avgRunes: c.avg_runes, total: c.total, hit1: c.hit_at_1, hit3: c.hit_at_3,
        hit5: c.hit_at_5, rate5: rate(c.hit_at_5, c.total),
      })),
      questions: docs.questions.map((q) => ({
        id: q.id, question: q.question, ranks: q.results.map(({ rank }, i) => ({
          config: docs.configs[i].id, rank, label: rankLabel(rank),
        })),
      })),
    };
  }

  function docsQuestionView(docs, questionID, configID) {
    const q = docs.questions.find((q) => q.id === questionID);
    const i = docs.configs.findIndex((c) => c.id === configID);
    if (!q || i === -1) return null;
    const config = { id: configID, label: configLabel(docs.configs[i]) };
    const { rank, hits } = q.results[i];
    function passage(ref) {
      const { path, heading, start_line: startLine, end_line: endLine, text } = docs.passages[ref];
      const location = path + ":" + (startLine === endLine ? startLine : startLine + "-" + endLine);
      return { path, heading, startLine, endLine, location, text, lines: endLine - startLine + 1 };
    }
    return {
      title: q.id + " · " + config.label, id: q.id, question: q.question, config,
      rank, rankLabel: rank === 0 ? TEXT.docsNoHit : rankLabel(rank), gold: q.gold.map(passage),
      hits: hits.map((h, n) => ({ n: n + 1, score: h.score, covers: h.covers, passage: passage(h.passage) })),
      siblings: docs.configs.map((c, j) => ({
        config: c.id, label: configLabel(c), rank: q.results[j].rank, current: i === j,
      })),
    };
  }

  const model = { ROOT_LABEL, KIND_LABEL, TOOL_LABEL, SCENARIOS, TEXT, overview, scenarioView, runView, realOverview, realRunView, docsOverview, docsQuestionView };
  if (typeof module === "object" && module.exports) module.exports = model;
  else window.DemoModel = model;
})();
