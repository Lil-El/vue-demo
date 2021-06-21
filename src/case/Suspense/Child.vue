<template>
    <div>Child</div>
</template>

<script>
export default {
    async setup() {
        let getUser = (delay) => {
            return new Promise((res) => {
                setTimeout(() => {
                    res();
                }, delay);
            });
        };
        const state1 = await getUser(3000);
        return { state: 123 };
    },
};
</script>

<style>
</style>