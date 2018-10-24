export default class GlobUtils {
    isDev() {
        return global.NODE_ENV !== 'prod'
    }
    isLogin() {
        return true
    }
    arryParse(arr){
        try{
            if (!Array.isArray(arr))
                arr = JSON.parse(arr)
        }catch(err){
            arr = null
        }
        return arr
    }
}