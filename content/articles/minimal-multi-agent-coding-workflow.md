---
{
  "id": 30,
  "slug": "minimal-multi-agent-coding-workflow",
  "kind": "learning-log",
  "title": "从单 Agent 到最小 Multi-Agent：我的 AI Coding 工作流进化",
  "date": "2026-07-09",
  "summary": "这篇成长日志记录我如何从让 AI 直接帮我写代码，进化到用 Planner、Worker、Reviewer 三个角色组织复杂 Coding 任务，让 AI Coding 变成有边界、有交接、有审查的工程流程。",
  "tags": [
    "AI Engineering",
    "Codex",
    "Multi-Agent",
    "Workflow",
    "Coding"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "ai-engineering",
    "go-infra",
    "api-design"
  ],
  "relatedProjectIds": [
    1,
    2,
    3
  ],
  "recommendedSlugs": [
    "codex-ai-workflow-system-retrospective",
    "erc4337-useroperation-lifecycle",
    "cex-evm-wallet-deposit-withdrawal-loop",
    "wallet-api-boundary"
  ],
  "suggestedQuestions": [
    "为什么最小 Multi-Agent 只需要 Planner、Worker 和 Reviewer？",
    "Multi-Agent Coding 和普通 AI 写代码有什么区别？",
    "什么时候应该使用 Multi-Agent，什么时候不应该？"
  ]
}
---

# 从单 Agent 到最小 Multi-Agent：我的 AI Coding 工作流进化

我一开始使用 AI Coding 时，最常见的方式是把一个目标直接交给 Codex：

```text
帮我实现这个功能
帮我修这个 bug
帮我把这篇文章写进网站
```

这种方式对小任务很有效。目标清楚、文件少、验证简单时，一个 Agent 往往可以直接完成。

但随着我开始用 AI 处理更复杂的事情，问题也变得明显：一个任务里同时包含需求澄清、代码修改、内容判断、构建验证和风险审查时，如果全部交给同一个连续对话，很容易出现三种偏差。

```text
目标漂移：做着做着开始扩展不必要的功能
边界遗漏：只完成表面实现，没有想清楚模块职责
验证不足：代码能跑，但没有认真检查失败路径和回归风险
```

这也是我开始需要 Multi-Agent 的原因。

但我后来意识到，最小的 Multi-Agent Coding 并不是同时开很多个 AI，也不是让一堆 Agent 自己讨论到天亮。对我来说，最有用的版本反而很小：固定三个角色。

```text
Planner
Worker
Reviewer
```

它们分别对应工程任务里最容易混在一起、但最好拆开的三个动作：

```text
先想清楚
再完成任务
最后挑问题
```

# 最小 Multi-Agent 不是养很多 AI

我现在对 Multi-Agent 的理解可以压缩成一句话：

```text
Multi-Agent = Role + Context + Handoff + Evaluation
```

也就是说，关键不是 Agent 的数量，而是每个角色有没有明确职责、共享了哪些上下文、怎么交接结果，以及最后如何评价质量。

如果没有这些边界，Agent 越多越容易乱。

一个 Agent 可能在没有完整上下文的情况下改代码；另一个 Agent 可能重复前一个 Agent 已经做过的判断；第三个 Agent 可能只是在重新总结，而没有真正审查风险。这样看起来很热闹，但对工程结果没有帮助。

所以我现在采用的是最小版本：

```text
我
-> Planner
-> Worker
-> Reviewer
-> 我
```

这里的重点是最后还要回到“我”。AI 可以计划、执行和审查，但最终目标是否正确、风险是否接受、内容是否符合我的表达，仍然需要我判断。

# Planner：先把任务变成可执行边界

Planner 不负责写代码，也不负责直接改文章。

它的价值是先把一个模糊目标拆成可执行边界：

```text
目标是什么
不做什么
要碰哪些文件
成功标准是什么
有哪些风险
需要怎样验证
```

比如我说“把一篇 Multi-Agent Coding 的文章写进 xiuqiu-site”，如果直接执行，模型很容易只新增一个 Markdown 文件。但 Planner 应该先判断这篇文章在网站中的位置：

```text
它是 AI Engineering 方向的成长日志
它应该承接 Codex Workflow 复盘
它不应该写成工具教程
它需要加入 AI Engineering 的阅读路径
它需要通过文章生成、知识索引、sitemap 和构建验证
```

这个阶段最重要的不是产出很多文字，而是把任务边界收窄到 Worker 可以稳定执行。

Planner 的好坏，决定了后面所有执行是否会偏航。

# Worker：按计划完成，不擅自扩大目标

Worker 的职责是执行计划。

这听起来简单，但它有一个很重要的约束：Worker 不应该随意改变目标。

如果 Planner 已经明确“本次只新增文章，不修改文章系统”，那 Worker 就不应该顺手重构 Markdown 渲染器、调整首页布局、增加新组件，或者把 Obsidian 也一起写了。

在我的使用里，Worker 更像一个非常专注的执行者：

```text
根据 frontmatter 规范新增文章
按既定结构写正文
把新文章加入对应知识路径
运行构建脚本
根据错误做最小修复
```

这和单 Agent 直接执行的区别在于：Worker 的自由度被前面的计划约束住了。

这种约束不是为了限制 AI，而是为了保护工程任务本身。复杂项目里最怕的不是 AI 写不出代码，而是它写得太主动，把无关部分也改了。

# Reviewer：不是总结，而是挑问题

Reviewer 的职责不是把 Worker 的结果再夸一遍，也不是重新复述实现过程。

它应该站在审查者角度问：

```text
有没有违反原始目标？
有没有遗漏测试？
有没有破坏已有行为？
有没有过度设计？
有没有信息泄露？
有没有内容口吻不符合网站定位？
```

对代码任务来说，Reviewer 要看 bug、类型错误、边界条件和回归风险。

对文章任务来说，Reviewer 要看结构是否清楚、内容是否像我自己的表达、有没有变成“AI 工具宣传”、有没有暴露内部路径或隐私信息。

我越来越觉得，AI Coding 里最容易被低估的是 Reviewer。

因为模型很擅长生成，但生成之后如果没有另一轮冷静审查，就很容易把“看起来完整”误认为“真的完成”。

# 一条最小工作流

把这三个角色合起来，我现在理解的最小 Multi-Agent Coding 流程是：

```text
我提出目标
-> Planner 拆任务、边界和验收标准
-> Worker 按计划执行实现或写作
-> Reviewer 审查 bug、遗漏、风险和表达
-> 我决定接受、修改或继续迭代
```

这条流程看起来比“直接让 AI 做”慢一点，但对复杂任务更稳。

它把一个大而模糊的任务拆成了几个相对清晰的责任段。每个阶段的输出都可以被下一阶段检查，而不是所有判断都混在同一段对话里。

我现在会把它理解成一种轻量工程流程，而不是炫技式的 Agent 编排。

# 它适合什么任务

我不会对所有事情都使用 Multi-Agent。

如果只是改一个 typo、查一个简单概念、调整一段普通文案，使用 Multi-Agent 反而会增加负担。

它更适合这些任务：

```text
新功能实现
复杂 bug 排查
钱包状态机调整
签名模块安全边界修改
生产事故或安全事件复盘
长文章重写和内容结构调整
需要构建验证的 AI Coding 任务
```

这些任务的共同点是：它们不只是“做完”，还需要说明为什么这样做、哪些地方不能动、如何证明结果可信。

如果一个任务的失败成本较高，或者它涉及多个模块、多个状态、多个验证步骤，我就更愿意使用 Planner / Worker / Reviewer 的拆分。

# 和我现有工作流的关系

我之前已经把一些重复任务沉淀成了工作流：

```text
钱包工程验证 loop
公众号增量同步 Skill
Web3 每日研究 Automation
Obsidian MCP 知识查询
```

这些系统解决的是“任务如何反复运行”的问题。

而 Multi-Agent Coding 解决的是另一个问题：一次复杂任务内部，AI 应该如何分工。

两者的关系可以这样理解：

```text
Workflow 解决任务如何反复运行
Multi-Agent 解决一次复杂任务如何分工和审查
```

例如，钱包工程验证 loop 可能每天都要运行。但在某一次运行中，如果发现提现状态机有 bug，我仍然需要一个小型 Multi-Agent 流程来处理：

```text
Planner：判断 bug 涉及 withdraw、sendout、账务还是通知
Worker：做最小修复并运行验证
Reviewer：检查是否引入重复出金、状态卡死或账务不平风险
```

所以 Multi-Agent 不是替代 Workflow，而是 Workflow 里的复杂步骤可以使用的组织方式。

# 我真正学到的变化

这段时间我最大的变化，不是“我更会写 Prompt 了”，也不是“AI 更强了”。

更准确地说，是我开始学会设计 AI 的工作边界。

以前我更关心怎么把问题问得足够具体，让 AI 给出一个结果。现在我更关心：

```text
谁负责计划
谁负责执行
谁负责审查
中间结果怎么交接
最终由谁判断
```

这让我对 AI Coding 的理解发生了变化。

AI 不是一个万能执行黑盒。它更像一组可以被组织起来的认知角色：有的适合拆问题，有的适合做实现，有的适合挑毛病。

当这些角色被明确下来，AI 才更像工程协作者，而不是一次性答案生成器。

# 对我的网站和学习系统意味着什么

这篇文章本身也提醒我一件事：我不应该只把结果写进 xiuqiu-site，还应该把“我如何得到这个结果”的方法沉淀下来。

比如 Web3 钱包文章展示的是工程理解；AI Workflow 文章展示的是我如何把重复任务变成可恢复系统；而这篇 Multi-Agent Coding 记录的是我如何组织 AI 完成复杂任务。

它们合在一起，才构成一个更完整的能力画像：

```text
我理解钱包系统
我能用 AI 辅助工程验证
我能把 AI 工作方式沉淀成可复用流程
我也能反过来审查 AI 的输出
```

这比单纯说“我会使用 AI 编程”更具体。

# 复述卡

这篇文章我希望自己最后能这样复述：

```text
一句话：
最小 Multi-Agent Coding 是 Planner、Worker、Reviewer 三角色组成的工程闭环。

一条流程：
计划 -> 执行 -> 审查 -> 人类确认。

三个边界：
Planner 不写代码，只拆目标和验收标准。
Worker 不改目标，只按计划执行。
Reviewer 不做无依据扩展，只检查 bug、遗漏和风险。

一个风险：
没有清晰交接和验证，Agent 越多越乱。
```

所以我现在不会把 Multi-Agent 理解成“开更多 AI”。我会把它理解成一种更小、更朴素、也更工程化的协作方式：

```text
把复杂任务拆成角色
把角色之间的交接说清楚
把最终判断留给人
```

这才是我当前阶段最有用的 Multi-Agent Coding。
