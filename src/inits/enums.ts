enum STCODES {
    SUCCESS = 200,              //操作成功
    QUERYEMPTY = 202,           //查无结果
    PARAMERR = 301,             //输入参数错误
    NOTFOUNDERR = 404,             //获取资源不存在
    UPLOADERR = 415,            //文件上传失败
    JWTAUTHERR = 400,           //授权错误或失效
    PASSWORDERR = 411,          //密码错误
    USERNAMEERR = 412,          //用户名错误或不存在
    AUTHORIZATIONERR = 413,    //权限不够
    USERNOTFOUNDERR = 414,         //用户不存在
    EXCEPTIONERR = 500,            //发生异常
    DBCONNECTERR = 701,        //数据库连接失败
    DBOPERATEERR = 702,        //数据库操作失败
    DBNEEDRESTARTERR = 703,  //数据库表修改，需要服务重启
    DBNEEDIDERR = 704,       //数据库表必须包含ID字段
    PARENTNOTFOUNDERR = 801,       //父记录不存在
}

const STMESSAGES = {
    [STCODES.SUCCESS]: 'Operation succeeded. ',
    [STCODES.QUERYEMPTY]: 'Query result is empty. ',
    [STCODES.PARAMERR]: 'Error: Param is wrong. ',
    [STCODES.NOTFOUNDERR]: 'Error: Request resource is not found. ',
    [STCODES.UPLOADERR]: 'Error: Upload file fail. ',
    [STCODES.JWTAUTHERR]: 'Error: Json web token authorize fail. ',
    [STCODES.PASSWORDERR]: 'Error: Password is wrong. ',
    [STCODES.USERNAMEERR]: 'Error: Username is wrong. ',
    [STCODES.AUTHORIZATIONERR]: 'Error: Authorization is less. ',
    [STCODES.USERNOTFOUNDERR]: 'Error: User is not found. ',
    [STCODES.EXCEPTIONERR]: 'Error: Exception is thrown. ',
    [STCODES.DBCONNECTERR]: 'Error: Database connection is wrong. ',
    [STCODES.DBOPERATEERR]: 'Error: Database operation is wrong. ',
    [STCODES.DBNEEDRESTARTERR]: 'Error: Database modify & serve need resart. ',
    [STCODES.DBNEEDIDERR]: 'Error: Database table must have id field. ',
    [STCODES.PARENTNOTFOUNDERR]: 'Error: Parent record is not found. ',
}

export {STCODES, STMESSAGES}