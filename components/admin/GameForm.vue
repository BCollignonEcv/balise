<script setup lang="ts">
import { GAME_STATUS_LABELS, type Game, type GameFormValues, type GameStatus } from '~/types/database'

const props = defineProps<{
  game?: Game | null
  submitLabel: string
  saving?: boolean
  error?: string | null
}>()

const emit = defineEmits<{ submit: [values: GameFormValues] }>()

const form = reactive({
  name: props.game?.name ?? '',
  code: props.game?.code ?? '',
  startsAt: isoToLocalInput(props.game?.starts_at),
  deadlineAt: isoToLocalInput(props.game?.deadline_at),
  status: (props.game?.status ?? 'draft') as GameStatus,
})

const statuses: GameStatus[] = ['draft', 'live', 'finished']
const isEdit = computed(() => !!props.game)
const deadlineLocked = computed(() => isEdit.value && form.status === 'finished')

const validationError = ref<string | null>(null)

const nameInput = ref<HTMLInputElement | null>(null)

/** Place le curseur dans le champ Nom et sélectionne son contenu. */
function focusName() {
  nameInput.value?.focus()
  nameInput.value?.select()
}

defineExpose({ focusName })

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function submit() {
  validationError.value = null
  const deadline = localInputToIso(form.deadlineAt)
  const starts = localInputToIso(form.startsAt)
  const code = normalizeCode(form.code)

  if (!form.name.trim()) return (validationError.value = 'Le nom de la partie est obligatoire.')
  if (!deadline) return (validationError.value = 'La date limite de réponse est obligatoire.')
  if (starts && starts >= deadline) return (validationError.value = 'La date de début doit précéder la date limite.')
  if (isEdit.value && !code) return (validationError.value = 'Le code de la partie est obligatoire.')
  if (code && (code.length < 4 || code.length > 12)) {
    return (validationError.value = 'Le code doit contenir entre 4 et 12 caractères.')
  }

  emit('submit', {
    name: form.name.trim(),
    code: code || null,
    starts_at: starts,
    deadline_at: deadline,
    status: form.status,
  })
}
</script>

<template>
  <form class="game-form" novalidate @submit.prevent="submit">
    <div class="field">
      <label class="field__label" for="game-name">Nom de la partie</label>
      <input id="game-name" ref="nameInput" v-model="form.name" class="input" type="text" placeholder="Ex. : La Grande Traque" required>
    </div>

    <div class="field">
      <label class="field__label" for="game-code">Code de la partie</label>
      <input
        id="game-code"
        :value="form.code"
        class="input game-form__code"
        type="text"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        :placeholder="isEdit ? '' : 'Généré automatiquement'"
        @input="form.code = normalizeCode(($event.target as HTMLInputElement).value)"
      >
      <span class="field__hint">4 à 12 lettres ou chiffres. Les participants le saisissent ou l’ont dans le lien.</span>
    </div>

    <div class="game-form__dates">
      <div class="field">
        <label class="field__label" for="game-start">Date de début</label>
        <input id="game-start" v-model="form.startsAt" class="input" type="datetime-local">
        <span class="field__hint">Optionnelle.</span>
      </div>
      <div class="field">
        <label class="field__label" for="game-deadline">Date et heure limite de réponse</label>
        <input
          id="game-deadline"
          v-model="form.deadlineAt"
          class="input"
          type="datetime-local"
          required
          :disabled="deadlineLocked"
        >
        <span v-if="deadlineLocked" class="field__hint">Repasse la partie « En cours » pour prolonger le jeu.</span>
      </div>
    </div>

    <fieldset class="field game-form__status">
      <legend class="field__label">Statut</legend>
      <div class="segmented">
        <label v-for="s in statuses" :key="s" class="segmented__option" :class="{ 'is-active': form.status === s }">
          <input v-model="form.status" class="visually-hidden" type="radio" name="status" :value="s">
          {{ GAME_STATUS_LABELS[s] }}
        </label>
      </div>
      <span class="field__hint">
        Brouillon : invisible des participants · En cours : jouable · Terminée : lecture seule.
      </span>
    </fieldset>

    <p v-if="validationError || error" class="form-error" role="alert">{{ validationError || error }}</p>

    <AppButton type="submit" variant="secondary" size="lg" block :loading="saving">
      {{ saving ? 'Enregistrement…' : submitLabel }}
    </AppButton>
  </form>
</template>

<style scoped>
.game-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.game-form__code {
  font-weight: 600;
  letter-spacing: 0.08em;
}

.game-form__dates {
  display: grid;
  gap: var(--space-5);
}

@media (min-width: 560px) {
  .game-form__dates {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.game-form__status {
  margin: 0;
  padding: 0;
  border: none;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.segmented__option {
  display: grid;
  place-items: center;
  min-height: 40px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
}

.segmented__option.is-active {
  background: var(--color-text);
  color: var(--color-surface);
}

.segmented__option:has(:focus-visible) {
  outline: 2px solid var(--color-secondary);
  outline-offset: 2px;
}
</style>
