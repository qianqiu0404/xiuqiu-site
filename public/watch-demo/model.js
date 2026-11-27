export const ALERT_NAMES = Object.freeze({
  timeout_streak: '连续超时',
  recovered: '恢复',
  budget_exceeded: '用量超额',
})

export function filterAlerts(alerts, type = '') {
  return alerts.filter(alert => !type || alert.type === type)
}
