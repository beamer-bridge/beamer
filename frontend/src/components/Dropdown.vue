<template>
  <Listbox v-model="selected" as="div">
    <div class="relative">
      <ListboxButton
        class="
          relative
          w-full
          bg-white
          border border-gray-300
          rounded-full
          shadow-sm
          pl-3
          pr-10
          py-2
          text-left
          cursor-default
          focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
          sm:text-sm
        "
      >
        <span class="flex items-center">
          <img :src="selected.icon" alt="" class="flex-shrink-0 h-6 w-6 rounded-full" />
          <span class="ml-3 block truncate">{{ selected.name }}</span>
        </span>
        <span class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <SelectorIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
        </span>
      </ListboxButton>

      <transition
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <ListboxOptions
          class="
            absolute
            z-10
            mt-1
            w-full
            bg-white
            shadow-lg
            max-h-56
            rounded-lg
            py-1
            text-base
            ring-1 ring-black ring-opacity-5
            overflow-auto
            focus:outline-none
            sm:text-sm
          "
        >
          <ListboxOption
            v-for="item in list"
            :key="item.id"
            v-slot="{ active, selected }"
            as="template"
            :value="item"
          >
            <li
              :class="[
                active ? 'text-white bg-indigo-600' : 'text-gray-900',
                'cursor-default select-none relative py-2 pl-3 pr-9',
              ]"
            >
              <div class="flex items-center">
                <img :src="item.icon" alt="" class="flex-shrink-0 h-6 w-6 rounded-full" />
                <span :class="[selected ? 'font-semibold' : 'font-normal', 'ml-3 block truncate']">
                  {{ item.name }}
                </span>
              </div>

              <span
                v-if="selected"
                :class="[
                  active ? 'text-white' : 'text-indigo-600',
                  'absolute inset-y-0 right-0 flex items-center pr-4',
                ]"
              >
                <CheckIcon class="h-5 w-5" aria-hidden="true" />
              </span>
            </li>
          </ListboxOption>
        </ListboxOptions>
      </transition>
    </div>
  </Listbox>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue';
import { CheckIcon, SelectorIcon } from '@heroicons/vue/solid';
import { ref } from 'vue';

interface Props {
  readonly list: Array<{ id: string; name: string; icon: string }>;
}
// interface Emits {
//   (e: 'formAccepted', formResult: RequestFormResult): void;
// }

defineProps<Props>();
// const emit = defineEmits<Emits>();

const selected = ref('');

// export default {
//   components: {
//     Listbox,
//     ListboxButton,
//     ListboxLabel,
//     ListboxOption,
//     ListboxOptions,
//     CheckIcon,
//     SelectorIcon,
//   },
//   setup() {
    

//     return {
//       list,
//       selected,
//     };
//   },
// };
</script>
