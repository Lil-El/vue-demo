
<script>
// <template>
//     <div class="container">
//         <div>MINO</div>
//     </div>
// </template>
import { useCssVars, useCssModule, withScopeId, getCurrentInstance } from "vue";
export default {
    props: ["name"],
    setup() {
        let $mino = useCssModule("mino");
        useCssVars((ctx) => {
            return {
                root: "red",
            };
        }, false);
        let ins = getCurrentInstance();
        console.log(ins.type.__scopeId);
        let withId = withScopeId(ins.type.__scopeId); // {$mino.container}
        let jsx = () => <div class="container"></div>;
        return withId(jsx) // 使用withScopeId包裹
        return jsx; // JSX无法使用scoped中的样式
        // return {
        //     $mino,
        // };
    },
};
</script>

<style lang="sass" scoped>
.container
    background-color: yellow
    width: 100px
    height: 100px
</style>
<style lang="sass" scoped module>
// 如果style为module，则必须使用cssModule才可以使用；普通的方式将不生效
// 默认module是 $style
.container
    background-color: green
    width: 100px
    height: 100px
</style>
<style lang="sass" scoped module="mino">
.container
    background-color: var(--root)
    width: 100px
    height: 100px
</style>
