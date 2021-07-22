<template>
    <h1>{{active}}</h1>
    <button @click="getList">Add</button>
</template>

<script>
export default {
    data(){
        return {
            list: 0
        }
    },
    computed: {
        active(){
            this.getList(); // 该函数内部调用了list，所以当click修改了list时，会触发active computed重新执行
            return "Active" + this.list;
        }
    },
    methods: {
        getList(){
            this.list = this.list + 1;
        }
    }
}
</script>

<style>

</style>