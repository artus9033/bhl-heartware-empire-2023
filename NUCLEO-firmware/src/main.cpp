#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>
#include "container.h"
#include <string.h>

#define STR_CHECK(STR1, STR2) (strcmp((STR1), (STR2)) == 0)

enum commands{
  no_op = 0,
  init_unit = 0x10,
  calibrate,
  take_out,
  put_in,
  auth_result,

  request_auth = 0xa0,
  unit_closed,
  cmd_debug
};

#define NR_OF_CONTAINERS 1

container containers[NR_OF_CONTAINERS];


void debug(char *str)
{
  Serial.print(char(cmd_debug));
  Serial.print(1);
  int i = 0;
  while((str[i] != 0)&&(i<64)){
    Serial.print(str[i]);
    i++;
  }
  while(i<64){
    Serial.print(char(0));
    i++;
  }
}


void setup() {
    Serial.begin(115200);
    SPI.begin();
    containers[0] = container(0, 10, 9, 3);
    debug("Booted\n");
}

void readCmd(char *buf, int size, uint32_t timeout){
  uint32_t startTime = millis();
  int i = 0;
  while(millis() - startTime < timeout){
    if(Serial.available()){
      delay(50);
      while (Serial.available()){
        buf[i] = Serial.read();
        // Serial.print(buf[i]);
        i++;
        if(i == size)
          return;
      }
    }
  }
}


void AskForAuth(int cid, char *ID)
{
  Serial.print(char(auth_result));
  Serial.print(char(cid));
  for (size_t i = 0; i < 4; i++)
  {
    Serial.print(ID[i]);
  }
}

/**
 * Helper routine to dump a byte array as hex values to Serial.
 */
void dump_byte_array(byte *buffer, byte bufferSize) {
  for (byte i = 0; i < bufferSize; i++) {
    Serial.print(buffer[i] < 0x10 ? " 0" : " ");
    Serial.print(buffer[i], HEX);
  }
}


void loop() {  
  char cmdBuf[20];
  for(int i = 0; i<20; i++){
    cmdBuf[i] = 0;
  }
  readCmd(cmdBuf, 18, 200);
  if(cmdBuf[0] != 0){
    bool isValidCmd = true;
    int cid = cmdBuf[1];
    switch (cmdBuf[0])
    {
    case init_unit:
      containers[cid].init_unit(cmdBuf+2, cmdBuf[18]);
      break;
    case calibrate:
      containers[cid].calibrate();
      break;
    case take_out:
      cmdBuf[2] = -cmdBuf[2];
    case put_in:
      containers[cid].SetQnt(cmdBuf[2]);
      break;
    case auth_result:
      if(cmdBuf[2] == 1){
        containers[cid].open();
      }
      else {
        containers[cid].wrongID();
      }
      break;
    
    default:
      isValidCmd = false;
      Serial.print(char(0x55));
      break;
    }
    if(isValidCmd){
      Serial.print(char(0xaa));
    }
  }
  
  for (size_t cid = 0; cid < NR_OF_CONTAINERS; cid++)
  {

    switch (containers[cid].state)
    {
    case waiting_for_auth:
      if(containers[cid].RFID_checkFlag()){
        char ID[4] = {0};
        containers[cid].RFID_getID(ID);
        AskForAuth(cid, ID);
      }
      break;
    default:
      break;
    }

  }
  

}

// void loop() {  
//   char cmdBuf[20];
//   for(int i = 0; i<20; i++){
//     cmdBuf[i] = 0;
//   }
//   readCmd(cmdBuf, 18, 200);
//   if(cmdBuf[0] != 0){
//     switch (cmdBuf[0])
//     {
//     case 0x10:
//       Serial.print(char(0xaa));
//       break;
//     case 0x11:
//       Serial.print(char(0xaa));
//       break;
//     case 0x12:
//       Serial.print(char(0xaa));
//       break;
//     case 0x13:
//       Serial.print(char(0xaa));
//       int cid = cmdBuf[1];
//       delay(230);
//       Serial.print(char(0xa0));
//       Serial.print(char(cid));
//       Serial.print(char(0x62));
//       Serial.print(char(0x6e));
//       Serial.print(char(0x65));
//       Serial.print(char(0x6a));
//       Serial.print(char(0xaa));
//       delay(500);
//       Serial.print(char(0xa0));
//       Serial.print(char(cid));
//       Serial.print(char(0x52));
//       Serial.print(char(0x0e));
//       Serial.print(char(0xf5));
//       Serial.print(char(0x1a));
//       Serial.print(char(0xaa));
//       delay(500);
//       Serial.print(char(0xa1));
//       Serial.print(char(cid));
//       break;
//     case 0x14:
//       Serial.print(char(0xaa));
//       break;
    
//     default:
//       Serial.print(char(0x55));
//       break;
//     }
//   }
// }

// void loop() {
//     if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
//       Serial.print(F("Reader "));
//       Serial.print(1);
//       // Show some details of the PICC (that is: the tag/card)
//       Serial.print(F(": Card UID:"));
//       dump_byte_array(mfrc522.uid.uidByte, mfrc522.uid.size);
//       Serial.println();
//       Serial.print(F("PICC type: "));
//       MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);
//       Serial.println(mfrc522.PICC_GetTypeName(piccType));

//       // Halt PICC
//       mfrc522.PICC_HaltA();
//       // Stop encryption on PCD
//       mfrc522.PCD_StopCrypto1();
//     } //if (mfrc522[reader].PICC_IsNewC
// }

// //test Serial
// void loop() {
//   char readStr[256];
//   if(Serial.available()){
//     delay(50);
//     int i = 0;
//     while (Serial.available()){
//       readStr[i] = Serial.read();
//       Serial.print(readStr[i]);
//       i++;
//     }
//     if((readStr[0] == 0x11) && (readStr[1] == 0)){
//       Serial.println("\n\n\n");
//       Serial.println("8======D");
//     }
//   }
// }
