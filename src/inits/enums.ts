enum STCODES {
    SUCCESS = 200,              //操作成功
    QUERYEMPTY = 202,           //查无结果
    PRAMAERR = 301,             //输入参数错误
    NOTFOUND = 404,      
    JWTAUTHERR = 400,        
    EXCEPTION = 500,            //发生异常
    DATABASECOERR = 701,        //数据库连接失败
    DATABASEOPERR = 702,        //数据库操作失败
}

export default STCODES