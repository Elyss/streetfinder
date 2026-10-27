<template>
    <div class="password-field">
        <input
            :id="id"
            :value="modelValue"
            :type="hidden ? 'password' : 'text'"
            :placeholder="placeholder"
            :autocomplete="autocomplete"
            :required="required"
            @input="emit('update:modelValue', $event.target.value)"
        />
        <button type="button" :title="hidden ? 'Afficher' : 'Masquer'" :aria-label="hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'"
            @click="hidden = !hidden">
            <Icon :name="hidden ? 'eye_off' : 'eye'" />
        </button>
    </div>
</template>

<script setup>
import { ref } from "vue"
import Icon from "@/components/Icon.vue"

defineProps({
    modelValue: { type: String, default: "" },
    id: { type: String, default: undefined },
    placeholder: { type: String, default: "Mot de passe" },
    autocomplete: { type: String, default: "current-password" },
    required: { type: Boolean, default: true },
})
const emit = defineEmits(["update:modelValue"])

const hidden = ref(true)
</script>

<style lang="scss" scoped>
.password-field{
    position: relative;

    input{
        padding-right: 2.6rem !important;
    }

    button{
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        display: grid;
        place-items: center;
        padding: 0.2rem;
        border: 0;
        background: none;
        color: #8a909b;
        cursor: pointer;

        &:hover{
            color: #4354b9;
        }
    }
}
</style>
