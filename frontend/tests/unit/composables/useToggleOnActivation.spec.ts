import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import { useToggleOnActivation } from '@/composables/useToggleOnActivation';

describe('useToggleOnActivation', () => {
  describe('activated', () => {
    it('is true when host component has been mounted or activated', async () => {
      let activated = ref(false);

      mount({
        setup() {
          const result = useToggleOnActivation();
          activated = result.activated;

          return () => {
            result;
          };
        },
      });

      expect(activated.value).toBe(true);
    });
  });
});
