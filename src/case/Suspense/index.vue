<template>
    <div>
        <Suspense>
            <template #default>
                <User />
            </template>
            <template #fallback>Loading...</template>
        </Suspense>
    </div>
</template>

<script>
import User from './User.vue'
export default {
    components: {User},
};
</script>

<style>
</style>