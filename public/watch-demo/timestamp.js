const beijingTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
})

function timeElement(value, label) {
  const time = document.createElement('time')
  time.setAttribute('datetime', value)
  time.textContent = label
  return time
}

const dateLabel = (year, month, day) => `${year} 年 ${month} 月 ${day} 日`

export function calendarDate(value) {
  return timeElement(value, dateLabel(...value.split('-').map(Number)))
}

export function timestamp(value) {
  const parts = beijingTime.formatToParts(new Date(value))
  const { year, month, day, hour, minute, second } = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]),
  )
  const clock = minute === 0 && second === 0 ? `${hour} 时整` : `${hour} 时 ${minute} 分 ${second} 秒`
  return timeElement(value, `北京时间，${dateLabel(year, month, day)} ${clock}`)
}
