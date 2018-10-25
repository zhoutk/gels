enum STCODES {
    SUCCESS = 200,              //操作成功
    QUERYEMPTY = 202,           //查无结果
    PRAMAERR = 301,             //输入参数错误
    NOTFOUND = 404,              
    EXCEPTION = 500,            //发生异常
    DATABASERR = 700,           //数据库操作失败
}

export default STCODES