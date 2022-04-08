import { FormKitNode } from '@formkit/core';

function rootClasses(sectionKey: string, node: FormKitNode): Record<string, boolean> {
  const type = node.props.type;

  const classConfig: Record<string, string | (() => string | undefined)> = {
    wrapper() {
      if (type === 'selector') {
        return 'flex flex-col gap-2 items-stretch';
      }
    },
    label() {
      if (type === 'selector') {
        return 'text-2xl';
      }
    },
    input() {
      if (type === 'button' || type === 'submit') {
        return 'py-6 px-14 rounded-xl bg-green shadow text-teal text-2xl disabled:bg-dark disabled:text-teal-light-35';
      }
      if (type === 'text') {
        return 'h-18 w-full px-8 rounded-xl bg-teal-light shadow-inner text-teal text-2xl text-left placeholder:opacity-25 placeholder:text-black';
      }
    },
  };

  function createClassObject(classesArray?: string) {
    const classList: Record<string, boolean> = {};
    if (typeof classesArray !== 'string') return classList;
    classesArray.split(' ').forEach((className) => {
      classList[className] = true;
    });
    return classList;
  }

  const target = classConfig[sectionKey];
  if (typeof target === 'string') {
    return createClassObject(target);
  } else if (typeof target === 'function') {
    return createClassObject(target());
  }

  return {};
}

export default function formkitTheme(node: FormKitNode) {
  node.config.rootClasses = rootClasses;
}
