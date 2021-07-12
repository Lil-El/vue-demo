<template>
    <div @click="handleClick">
        <Watch name="setUp" />
    </div>
</template>

<script>
import { reactive } from "@vue/reactivity";
import Watch from "@/case/Setup/index.vue";
import { watch } from "vue";
export default {
    components: { Watch },
    setup() {
        let state = reactive({
            obj: 1,
        });
        watch(
            () => state.obj,
            () => {
                console.log("change");
            }
        );
        let handleClick = () => {
            state.obj = "yxd";
            state.obj = "mino";
        };
        return {
            handleClick,
        };
    },
};
</script>

<style lang="scss">
* {
    padding: 0;
    margin: 0;
}
</style>