import type { RadarCollectionKind } from './snapshotFreshness'

export type RadarCorrectionKind = RadarCollectionKind | 'review'

export interface RadarCorrection {
  readonly id: string
  readonly date: string
  readonly targets: readonly { readonly kind: RadarCorrectionKind; readonly slug: string }[]
  readonly summary: string
  readonly boundary: string
  readonly source: { readonly label: string; readonly url: string; readonly publishedAt: string }
}

// Subsequent corrections accompany frozen editions; they never replace snapshot content.
const corrections: readonly RadarCorrection[] = [{
  id: 'hoodi-glamsterdam-postponed',
  date: '2026-10-25',
  targets: [
    { kind: 'learning', slug: '2026-10-24' },
    { kind: 'market', slug: '2026-10-24' },
    { kind: 'review', slug: '2026-10-18--2026-10-23' },
  ],
  summary: 'Ethereum Foundation 于 2026-10-22 公告：原定 10 月 26 日的 Hoodi Glamsterdam 升级已延期，尚未确定新日期。Amsterdam（执行层）与 Gloas（共识层）的旧激活配置，以及同一 epoch 提升至 200M gas limit 的计划均已撤销。',
  boundary: '本次更正仅针对 Hoodi 测试网，不是以太坊主网排期或主网用户操作通知。原始冻结正文保留供追溯，不能再按旧日期安排 Hoodi 激活。',
  source: {
    label: 'Ethereum Foundation：Hoodi Glamsterdam 延期公告',
    url: 'https://blog.ethereum.org/2026/10/22/glamsterdam-hoodi-delay',
    publishedAt: '2026-10-22',
  },
}]

export function getRadarCorrections(kind: RadarCorrectionKind, slug?: string): readonly RadarCorrection[] {
  return corrections.filter(correction => correction.targets.some(target => target.kind === kind && target.slug === slug))
}
