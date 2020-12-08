#include <cstdio>
#include <cstring>
#include "public.h"
#include "Alarm.h"
#include <fstream>
#include <iostream>
#include <string>
#include <signal.h>
#include <unistd.h>
#define GetCurrentDir getcwd

using namespace std;

volatile sig_atomic_t e_flag = 0;
void sig_handler(int sig)
{
  e_flag = 1;
}

int SendMessage(NET_CLIENT_MSG msg)
{
  char buf[1024] = {0};
  sprintf(
    buf,
    "[MSG_SEND] %s,%d,%f,%d,%s,%s,%s",
    msg.sAlermType,
    msg.dwEmployeeNo,
    msg.fCurrTemperature,
    msg.byIsAbnomalTemperature,
    msg.sPicturePath,
    msg.sThermalPicturePath,
    msg.sVisibleLightPicturePath
  );
  std::cout << buf << std::endl;
  return 0;
}

void CALLBACK MessageCallback(LONG lCommand, NET_DVR_ALARMER *pAlarmer, char *pAlarmInfo, DWORD dwBufLen, void *pUser)
{
  switch (lCommand)
  {
  case COMM_ALARM_ACS:
  {
    char* cAlermType = "COMM_ALERM_ACS";
    NET_DVR_ACS_ALARM_INFO struAlarmInfo;
    memcpy(&struAlarmInfo, pAlarmInfo, sizeof(NET_DVR_ACS_ALARM_INFO));

    //ファイルパス取得
    char cCurrentPath[MAX_FILE_PATH_LEN];
    GetCurrentDir(cCurrentPath, sizeof(cCurrentPath));

    char cPicturePath[MAX_FILE_PATH_LEN] = {0};
    char cThermalPicturePath[MAX_FILE_PATH_LEN] = {0};
    char cVisibleLightPicturePath[MAX_FILE_PATH_LEN] = {0};

    if (struAlarmInfo.byAcsEventInfoExtendV20)
    {
      NET_DVR_ACS_EVENT_INFO_EXTEND_V20 strInfoExtendv2;
      memcpy(&strInfoExtendv2, struAlarmInfo.pAcsEventInfoExtendV20, sizeof(NET_DVR_ACS_EVENT_INFO_EXTEND_V20));
      if (struAlarmInfo.dwPicDataLen > 0)
      {
        fstream file("./picture.jpg", ios::binary | ios::out);
        file.write((char *)struAlarmInfo.pPicData, struAlarmInfo.dwPicDataLen);
        file.close();
        sprintf(cPicturePath, "%s/%s", cCurrentPath, "picture.jpg");
      }
      if (strInfoExtendv2.dwThermalDataLen > 0)
      {
        fstream file("./thermal.jpg", ios::binary | ios::out);
        file.write((char *)strInfoExtendv2.pThermalData, strInfoExtendv2.dwThermalDataLen);
        file.close();
        sprintf(cThermalPicturePath, "%s/%s", cCurrentPath, "thermal.jpg");
      }
      if (strInfoExtendv2.dwVisibleLightDataLen > 0)
      {
        fstream file("./visible_light.jpg", ios::binary | ios::out);
        file.write((char *)strInfoExtendv2.pVisibleLightData, strInfoExtendv2.dwVisibleLightDataLen);
        file.close();
        sprintf(cVisibleLightPicturePath, "%s/%s", cCurrentPath, "visible_light.jpg");
      }
      //結果を送信
      if (struAlarmInfo.dwMinor == MINOR_FACE_VERIFY_PASS || struAlarmInfo.dwMinor == MINOR_FACE_VERIFY_FAIL)
      {
        NET_CLIENT_MSG struClientMsg;

        memcpy(struClientMsg.sAlermType, cAlermType, MAX_ALERM_TYPE_LEN);
        struClientMsg.dwEmployeeNo = struAlarmInfo.struAcsEventInfo.dwEmployeeNo;
        struClientMsg.fCurrTemperature = strInfoExtendv2.fCurrTemperature;
        struClientMsg.byIsAbnomalTemperature = strInfoExtendv2.byIsAbnomalTemperature;
        memcpy(struClientMsg.sPicturePath, cPicturePath, MAX_FILE_PATH_LEN);
        memcpy(struClientMsg.sThermalPicturePath, cThermalPicturePath, MAX_FILE_PATH_LEN);
        memcpy(struClientMsg.sVisibleLightPicturePath, cVisibleLightPicturePath, MAX_FILE_PATH_LEN);
        SendMessage(struClientMsg);
      }
    }
  }
    break;
  default:
    break;
  }
}

int Demo_Alarm(LONG lUserID)
{
  signal(SIGINT, sig_handler);
  signal(SIGKILL, sig_handler);

  NET_DVR_SetDVRMessageCallBack_V51(0, MessageCallback, nullptr);

  LONG lHandle;
  NET_DVR_SETUPALARM_PARAM_V50 struSetupAlarmParam = {0};
  struSetupAlarmParam.dwSize = sizeof(struSetupAlarmParam);
  struSetupAlarmParam.byRetVQDAlarmType = TRUE; //Prefer VQD Alarm type of NET_DVR_VQD_ALARM
  struSetupAlarmParam.byRetAlarmTypeV40 = TRUE;
  struSetupAlarmParam.byFaceAlarmDetection = 1; //m_comFaceAlarmType.GetCurSel();
  struSetupAlarmParam.byRetDevInfoVersion = TRUE;
  struSetupAlarmParam.byAlarmInfoType = 1;
  struSetupAlarmParam.bySupport = 4;
  lHandle = NET_DVR_SetupAlarmChan_V50(lUserID, &struSetupAlarmParam, nullptr, 0);

  if (lHandle < 0)
  {
    char buf[1024] = {0};
    sprintf(buf, "NET_DVR_SetupAlarmChan_V50 error, %d\n", NET_DVR_GetLastError());
    std::cerr << buf << std::endl;
    return HPR_ERROR;
  }

  // Wait.
  for (;;)
  {
    if (e_flag)
    {
      return HPR_OK;
    }
  }
}
