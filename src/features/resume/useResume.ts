import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setSeoMeta } from '../../utils/seo'
import { projects, filterResumeProjects, normalizeCategory, projectIdFromHash, adjacentProjectId, resumeSeo, loadProjectNotes } from './data'

export function useResume() {
  const route = useRoute()
  const router = useRouter()
  const query = ref('')
  const includeHistory = ref(true)
  const category = computed(() => normalizeCategory(route.query.category, projects))
  const visibleProjects = computed(() => filterResumeProjects(projects, category.value, includeHistory.value, query.value))
  const selectedId = computed(() => projectIdFromHash(route.hash, projects))
  const activeProject = computed(() => projects.find(project => project.id === selectedId.value))
  const activeIndex = computed(() => projects.findIndex(project => project.id === selectedId.value))
  const dialog = ref<HTMLDialogElement>()
  const dialogBody = ref<HTMLElement>()
  const closeButton = ref<HTMLButtonElement>()
  const searchInput = ref<HTMLInputElement>()
  const detailState = ref<'loading' | 'ready' | 'error'>('loading')
  const noteHtml = ref('')
  const copyLabel = ref('复制链接')
  const copied = ref(false)
  const dark = ref(false)
  let opener: HTMLElement | null = null
  let ownsHistory = false
  let disposed = false
  let loadVersion = 0
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  const media = typeof window === 'undefined' ? undefined : window.matchMedia('(prefers-color-scheme: dark)')

  function pauseMedia() {
    dialogBody.value?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(element => element.pause())
  }
  function updateThemeState() {
    dark.value = document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme && Boolean(media?.matches))
  }
  function toggleTheme() {
    dark.value = !dark.value
    const value = dark.value ? 'dark' : 'light'
    document.documentElement.dataset.theme = value
    try { localStorage.setItem('xiuqiu-theme', value) } catch { /* preference still applies for this visit */ }
    window.dispatchEvent(new Event('xiuqiu-theme-change'))
  }
  function setCategory(value: string) {
    const nextQuery = { ...route.query }
    if (value === 'all') delete nextQuery.category
    else nextQuery.category = normalizeCategory(value, projects)
    void router.replace({ path: route.path, query: nextQuery, hash: route.hash })
  }
  function resetSearch() {
    query.value = ''
    includeHistory.value = true
    setCategory('all')
    searchInput.value?.focus()
  }
  function openProject(id: string, event?: Event) {
    if (!projects.some(project => project.id === id)) return
    if (event?.currentTarget instanceof HTMLElement) opener = event.currentTarget
    const location = { path: route.path, query: route.query, hash: `#project/${id}` }
    if (selectedId.value) void router.replace(location)
    else { ownsHistory = true; void router.push(location) }
  }
  function closeProject() {
    if (!selectedId.value) return
    if (ownsHistory) { ownsHistory = false; router.back() }
    else void router.replace({ path: route.path, query: route.query, hash: '#catalog' })
  }
  function onDialogClose() {
    pauseMedia()
    document.body.removeAttribute('data-resume-modal')
    if (disposed) return
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true })
    else searchInput.value?.focus({ preventScroll: true })
  }
  async function loadDetail() {
    const id = selectedId.value
    if (!id) return
    const version = ++loadVersion
    detailState.value = 'loading'
    noteHtml.value = ''
    try {
      const notes = await loadProjectNotes()
      if (disposed || version !== loadVersion || selectedId.value !== id) return
      if (!notes[id]) throw new Error('Missing public project summary')
      noteHtml.value = notes[id]
      detailState.value = 'ready'
    } catch {
      if (!disposed && version === loadVersion) detailState.value = 'error'
    }
  }
  async function syncDialog() {
    if (disposed) return
    pauseMedia()
    copied.value = false
    copyLabel.value = '复制链接'
    if (!selectedId.value) {
      ++loadVersion
      ownsHistory = false
      dialog.value?.close()
      return
    }
    await nextTick()
    if (!dialog.value || disposed) return
    if (!dialog.value.open) dialog.value.showModal()
    document.body.setAttribute('data-resume-modal', '')
    dialog.value.scrollTop = 0
    closeButton.value?.focus({ preventScroll: true })
    await loadDetail()
  }
  function stepProject(step: number) {
    if (selectedId.value) openProject(adjacentProjectId(projects, selectedId.value, step))
  }
  function onDialogKey(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if ((event.target as Element)?.closest('input,textarea,video,audio,select,[contenteditable]')) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      stepProject(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }
  function onBackdropClick(event: MouseEvent) {
    if (event.target !== dialog.value) return
    const box = dialog.value.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeProject()
  }
  function onSearchShortcut(event: KeyboardEvent) {
    if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey || dialog.value?.open) return
    if ((event.target as Element)?.closest('input,textarea,select,[contenteditable]')) return
    event.preventDefault()
    document.getElementById('catalog')?.scrollIntoView({ block: 'start' })
    searchInput.value?.focus({ preventScroll: true })
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      if (disposed) return
      copied.value = true
      copyLabel.value = '已复制 ✓'
    } catch { copyLabel.value = '复制失败，请复制地址栏链接' }
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copyLabel.value = '复制链接'; copied.value = false }, 2500)
  }
  watch(selectedId, syncDialog)
  onMounted(() => {
    setSeoMeta({ ...resumeSeo, path: '/' })
    updateThemeState()
    media?.addEventListener('change', updateThemeState)
    window.addEventListener('xiuqiu-theme-change', updateThemeState)
    window.addEventListener('keydown', onSearchShortcut)
    void syncDialog()
  })
  onBeforeUnmount(() => {
    disposed = true
    ++loadVersion
    clearTimeout(copyTimer)
    pauseMedia()
    dialog.value?.close()
    document.body.removeAttribute('data-resume-modal')
    media?.removeEventListener('change', updateThemeState)
    window.removeEventListener('xiuqiu-theme-change', updateThemeState)
    window.removeEventListener('keydown', onSearchShortcut)
  })
  return { projects, query, includeHistory, category, visibleProjects, activeProject, activeIndex, dialog, dialogBody, closeButton, searchInput, detailState, noteHtml, copyLabel, copied, dark, toggleTheme, setCategory, resetSearch, openProject, closeProject, onDialogClose, loadDetail, stepProject, onDialogKey, onBackdropClick, copyLink }
}
