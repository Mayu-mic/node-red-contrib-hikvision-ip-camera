#define MAX_ALERM_TYPE_LEN 32 //length of alerm type

typedef struct
{
  char sAlermType[MAX_ALERM_TYPE_LEN];
  WORD dwEmployeeNo;
  float fCurrTemperature;
  BYTE byIsAbnomalTemperature; // is abnomal temperature(0-no,1-yes)
  char sPicturePath[MAX_FILE_PATH_LEN];
  char sThermalPicturePath[MAX_FILE_PATH_LEN];
  char sVisibleLightPicturePath[MAX_FILE_PATH_LEN];
} NET_CLIENT_MSG, *LNET_CLIENT_MSG;

//Alarm Test
int Demo_Alarm(LONG lUserID);
