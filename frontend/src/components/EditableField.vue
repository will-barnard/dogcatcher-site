<template>
  <component
    :is="tag"
    v-if="!editing"
    class="editable"
    :class="{ empty: !modelValue }"
    @click="startEdit"
  >{{ modelValue || placeholder }}<span class="edit-mark">✎</span></component>
  <div v-else class="editable editing-field">
    <textarea
      v-if="block"
      ref="fieldEl"
      v-model="draft"
      :rows="rows"
      @keydown.esc="cancel"
    ></textarea>
    <input
      v-else
      ref="fieldEl"
      :type="type"
      v-model="draft"
      @keydown.enter="save"
      @keydown.esc="cancel"
    />
    <div class="editable-actions">
      <button class="shrink" @click="save" :disabled="saving">Save</button>
      <button class="shrink ghost" @click="cancel" :disabled="saving">Cancel</button>
    </div>
  </div>
</template>

<script setup>
// Generic click-to-edit text field. Not editing: renders the value (or a
// placeholder) as plain content with a small pencil mark on hover. Click
// swaps it for an input/textarea with explicit Save/Cancel -- no
// autosave-on-blur, no animation, so nothing changes until you tell it to.
//
// `onSave` is a required async function(newValue); it should throw on
// failure. On success we emit update:modelValue so a v-model binding on
// the caller's reactive data stays in sync. On failure we emit 'error'
// and leave the field open so the draft isn't lost.
import { ref, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  block: { type: Boolean, default: false },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '(click to edit)' },
  rows: { type: Number, default: 4 },
  tag: { type: String, default: 'span' },
  onSave: { type: Function, required: true },
});
const emit = defineEmits(['update:modelValue', 'error']);

const editing = ref(false);
const saving = ref(false);
const draft = ref('');
const fieldEl = ref(null);

function startEdit() {
  draft.value = props.modelValue || '';
  editing.value = true;
  nextTick(() => fieldEl.value && fieldEl.value.focus());
}

function cancel() {
  editing.value = false;
}

async function save() {
  saving.value = true;
  try {
    await props.onSave(draft.value);
    emit('update:modelValue', draft.value);
    editing.value = false;
  } catch (e) {
    emit('error', e);
  } finally {
    saving.value = false;
  }
}
</script>
