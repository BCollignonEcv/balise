/**
 * Horloge de la partie, calée sur l'heure du serveur (l'heure du téléphone ne compte pas).
 * Le contrôle définitif de la date limite reste fait par le serveur à l'envoi.
 */
export function useGameClock() {
  const { state, game } = usePlayerSession()

  const serverNow = () => Date.now() + state.value.clockOffsetMs
  const now = ref(serverNow())
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    now.value = serverNow()
    timer = setInterval(() => (now.value = serverNow()), 1000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  const deadlineMs = computed(() => (game.value ? new Date(game.value.deadline_at).getTime() : 0))
  const startsAtMs = computed(() => (game.value?.starts_at ? new Date(game.value.starts_at).getTime() : null))

  const remainingMs = computed(() => Math.max(0, deadlineMs.value - now.value))
  const gameOver = computed(() => !!game.value && (game.value.status === 'finished' || now.value >= deadlineMs.value))
  const notStarted = computed(() => startsAtMs.value !== null && now.value < startsAtMs.value)
  /** Moins de 10 minutes : on met le compte à rebours en évidence. */
  const urgent = computed(() => !gameOver.value && remainingMs.value < 10 * 60 * 1000)

  return { now, deadlineMs, startsAtMs, remainingMs, gameOver, notStarted, urgent }
}
