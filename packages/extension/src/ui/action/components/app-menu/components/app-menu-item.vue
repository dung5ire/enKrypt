<template>
  <a
    :id="network.name"
    ref="target"
    class="app-menu__link hover-transition-no-bg"
    :class="[
      { active: isActive },
      { 'sticky-top': isStickyTop },
      { 'sticky-bottom': isStickyTop === false },
    ]"
  >
    <div class="app-menu__link__block">
      <div style="position: relative">
        <img ref="imageTag" :src="network.icon" alt="" />
        <new-icon
          v-if="newNetworkTags.networks.includes(network.name)"
          class="app-menu-network-tag app-menu-network-tag-new"
        />
        <div
          v-if="
            !newNetworkTags.networks.includes(network.name) &&
            newNetworkTags.swap.includes(network.name)
          "
          class="app-menu-network-tag app-menu-network-tag-swap"
        >
          <swap-added-icon
            class="app-menu-network-tag-swap-icon"
          ></swap-added-icon>
        </div>
      </div>
      <span>{{ network.name_long }} </span
      ><test-network-icon
        v-if="network.isTestNetwork"
        class="test-network-icon"
      />
    </div>
    <div class="app-menu__link__block">
      <DragIcon v-if="canDrag" class="app-menu__link__block__drag" />
      <div
        :class="[
          'app-menu__link__block__pin',
          { 'app-menu__link__block__pin__visible': props.isPinned },
        ]"
        @click.stop="setPinned"
      >
        <pin-icon :is-pinned="props.isPinned" :is-active="true" />
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import { NodeType } from '@/types/provider';
import { PropType, ref, watch, onMounted, nextTick, onUnmounted } from 'vue';
import TestNetworkIcon from '@action/icons/common/test-network-icon.vue';
import NewIcon from '@action/icons/asset/new-icon.vue';
import SwapAddedIcon from '@/ui/action/icons/asset/swap-added-icon.vue';
import PinIcon from '@action/icons/actions/pin.vue';
import DragIcon from '@action/icons/common/drag-icon.vue';

import { trackNetwork } from '@/libs/metrics';
import { NetworkChangeEvents, NetworkType } from '@/libs/metrics/types';

const props = defineProps({
  network: {
    type: Object as PropType<NodeType>,
    default: () => {
      return {};
    },
  },
  isActive: {
    type: Boolean,
    default: () => {
      return false;
    },
  },
  isPinned: {
    type: Boolean,
    required: true,
  },
  scrollPosition: {
    type: Number,
    default: 0,
  },
  canDrag: {
    type: Boolean,
    required: false,
    default: false,
  },
  newNetworkTags: {
    type: Object as PropType<{ networks: string[]; swap: string[] }>,
    default: () => {
      return { networks: [], swap: [] };
    },
  },
});

const imageTag = ref<HTMLImageElement | null>(null);

const emit = defineEmits<{
  (e: 'update:gradient', data: string): void;
  (e: 'update:pinNetwork', network: string, isPinned: boolean): void;
}>();

/**
 * Function to convert the RGB values to a hex color.
 * The color is used to set the gradient background of the menu items.
 */
const componentToHex = (c: number) => {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
};
const getAverageRGB = (imgEl: HTMLImageElement) => {
  const blockSize = 5, // only visit every 5 pixels
    defaultRGB = { r: 0, g: 0, b: 0 }, // for non-supporting envs
    canvas = document.createElement('canvas'),
    context = canvas.getContext && canvas.getContext('2d'),
    rgb = { r: 0, g: 0, b: 0 };
  let data: ImageData;
  let count = 0;
  let i = -4;

  if (!context) {
    return defaultRGB;
  }
  const height = (canvas.height =
    imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height);
  const width = (canvas.width =
    imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width);
  context.drawImage(imgEl, 0, 0);
  try {
    data = context.getImageData(0, 0, width, height);
  } catch (e) {
    return defaultRGB;
  }
  const length = data.data.length;
  while ((i += blockSize * 4) < length) {
    ++count;
    rgb.r += data.data[i];
    rgb.g += data.data[i + 1];
    rgb.b += data.data[i + 2];
  }
  // ~~ used to floor values
  rgb.r = ~~(rgb.r / count);
  rgb.g = ~~(rgb.g / count);
  rgb.b = ~~(rgb.b / count);
  emit(
    'update:gradient',
    `#${componentToHex(rgb.r)}${componentToHex(rgb.g)}${componentToHex(rgb.b)}`,
  );
};
/**
 * Watcher to get the average RGB value of the image and get position when the menu item is active.
 */
watch(
  () => props.isActive,
  newval => {
    if (newval) {
      getAverageRGB(imageTag.value!);
      getPosition();
    }
  },
);

/**
 * Watcher to recalculate position on pinned.
 */
watch(
  () => props.isPinned,
  async () => {
    if (props.isActive) {
      await nextTick();
      getPosition();
    }
  },
);

/** ------------------------
 * Buttons
 * ------------------------*/

const setPinned = async () => {
  const networkType = props.network.isTestNetwork
    ? NetworkType.Testnet
    : props.network.isCustomNetwork
      ? NetworkType.Custom
      : NetworkType.Regular;
  trackNetwork(NetworkChangeEvents.NetworkPinnedStatusChanged, {
    network: props.network.name,
    networkType: networkType,
    isPinned: !props.isPinned,
  });
  emit('update:pinNetwork', props.network.name, !props.isPinned);
};

/** ------------------------
 * Scroll
------------------------*/
const target = ref<HTMLElement | null>(null);

/**
 * Reactive variable to determine the sticky state of the menu item.
 * It is set to `true` if the menu item is sticky at the top, `false` if it is sticky at the bottom, and `undefined` if it is not sticky.
 */
const isStickyTop = ref<boolean | undefined>(undefined);

/**
 * Function to determine the position of the menu item and set its sticky state top or bottom.
 * It calculates the position based on the scroll position, direction and the offset.
 */
const getPosition = () => {
  if (!target.value) return;
  const height = target.value?.offsetHeight || 0;
  const offset = -height;
  const anchorTop = (target.value?.offsetTop || 0) + offset;
  if (props.scrollPosition > anchorTop) {
    isStickyTop.value = true;
  } else {
    isStickyTop.value = false;
  }
};

/**
 * Ensures that selected menu items are sticky when the page is mounted.
 */
onMounted(() => {
  nextTick(() => {
    if (props.isActive) {
      getPosition();
    }
  });
});

/**
 * Watcher to update the position of the menu item when the scroll position changes.
 */
watch(
  () => props.scrollPosition,
  () => {
    if (props.isActive) {
      getPosition();
    }
  },
);

onUnmounted(() => {
  // Clear any cached values or listeners
  isStickyTop.value = undefined;
});
</script>

<style lang="less">
@import '@action/styles/theme.less';

.app-menu-network-tag {
  background: rgba(0, 122, 255, 1);
  color: #fff !important;
  border: 1px solid @white;
  position: absolute;
  left: 23px;
  top: -5px;
  &-new {
    padding: 1px 3px 0px 3px;
    height: 9px;
    border-radius: 6px;
  }
  &-swap {
    height: 13px;
    width: 22px;
    border-radius: 8px;
    &-icon {
      display: absolute;
      padding-left: 2px;
      padding-top: 1px;
      width: 19px;
    }
  }
}

.app-menu {
  &__link {
    text-decoration: none;
    display: flex;
    justify-content: space-between;
    justify-self: center;
    align-items: center;
    flex-direction: row;
    width: 97%;
    min-height: 40px !important;
    max-height: 40px;
    margin-bottom: 3px;
    margin-top: 3px;
    cursor: pointer;
    position: relative;
    border-radius: 10px;
    padding-right: 8px;
    transition: top 1s linear;
    transition: bottom 1s linear;
    &:first-of-type {
      margin-top: 0; /* Removes top margin for the first element */
    }
    &__block {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      flex-direction: row;
      gap: 4px;
      &__pin {
        max-width: 32px;
        max-height: 24px;
        padding: 5px 8px 3px 8px;
        background: transparent;
        border-radius: 24px;
        opacity: 0;
        transition: @opacity-noBG-transition;
        &:hover {
          background: @primaryLight;
        }
        &__visible {
          transition: opacity 300ms ease-in;
          svg path {
            fill: #5f6368;
            fill-opacity: 0.4;
          }
          opacity: 1 !important;
        }
      }
      &__drag {
        max-width: 20px;
        max-height: 20px;
        padding: 5px 0px 3px 0px;
        background: transparent;
        border-radius: 24px;
        opacity: 0;
        transition: opacity 0.3s ease-in;
      }
    }
    &:hover {
      .app-menu__link__block__drag,
      .app-menu__link__block__pin {
        transition: opacity 300ms ease-in;
        opacity: 1 !important;
      }
      .app-menu__link__block__pin__visible {
        svg path {
          fill: #684cff;
          fill-opacity: 1;
        }
        opacity: 1 !important;
      }
    }

    img {
      width: 24px;
      height: 24px;
      margin: 0 8px;
      border-radius: 50%;
    }

    span {
      font-style: normal;
      font-weight: normal;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0.25px;
      color: @primaryLabel;
    }

    &.active {
      background: @white;
      box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.16);
      position: -webkit-sticky;
      position: sticky;
      z-index: 2;
      opacity: 1;
      span {
        font-weight: 500;
      }
      &:hover {
        background: @white;
      }

      .app-menu__link__block__pin {
        transition: opacity 300ms ease-in;
        opacity: 1;
      }
      .app-menu__link__block__pin__visible {
        svg path {
          fill: #684cff !important;
          fill-opacity: 1;
        }
        opacity: 1 !important;
      }
    }
    /* Sticky to top or bottom */
    &.sticky-top {
      top: 0;
    }

    &.sticky-bottom {
      bottom: 0;
    }

    &-drag {
      position: absolute;
      right: 8px;
      padding: 4px;
      top: 50%;
      margin-top: -12px;
      cursor: grab;
      opacity: 0;
    }
  }
}
.test-network-icon {
  height: 14px;
  width: 14px;
}
</style>
