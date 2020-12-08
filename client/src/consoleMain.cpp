#include <stdio.h>
#include <iostream>
#include "public.h"
#include "Alarm.h"
#include <string.h>
using namespace std;

int main(int argc, char *argv[])
{
    if (argc < 5)
    {
        char buf[1024] = {0};
        sprintf(buf, "Please set argv (address,port,username,password)\n");
        std::cerr << buf << std::endl;
        return HPR_ERROR;
    }

    NET_DVR_Init();

    //Login device
    NET_DVR_USER_LOGIN_INFO struLoginInfo = {0};
    NET_DVR_DEVICEINFO_V40 struDeviceInfoV40 = {0};
    struLoginInfo.bUseAsynLogin = false;
    struLoginInfo.wPort = atoi(argv[2]);
    memcpy(struLoginInfo.sDeviceAddress, argv[1], NET_DVR_DEV_ADDRESS_MAX_LEN);
    memcpy(struLoginInfo.sUserName, argv[3], NAME_LEN);
    memcpy(struLoginInfo.sPassword, argv[4], NAME_LEN);

    LONG lUserID = NET_DVR_Login_V40(&struLoginInfo, &struDeviceInfoV40);

    if (lUserID < 0)
    {
        char buf[1024] = {0};
        sprintf(buf, "Login error, %d\n", NET_DVR_GetLastError());
        std::cerr << buf << std::endl;
        NET_DVR_Cleanup();
        return HPR_ERROR;
    }

    std::cout << "Alarm listening start." << std::endl;

    if (Demo_Alarm(lUserID) == HPR_ERROR)
    {
      NET_DVR_Logout_V30(lUserID);
      NET_DVR_Cleanup();
      return HPR_ERROR;
    }

    // logout.
    std::cout << "Alarm listening stop." << std::endl;
    NET_DVR_Logout_V30(lUserID);
    NET_DVR_Cleanup();
    return HPR_OK;
}
