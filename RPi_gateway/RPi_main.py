import serial
from typing import Dict, Any, List, Tuple, Optional
from time import sleep
import socketio
import os
import json
import sys
import os
import atexit

try:
    with open("/sys/firmware/devicetree/base/model", "r") as f:
        isRPI = ("raspberry" in f.read().lower())
except:
    # we must be on a non-linux then
    isRPI = False

if isRPI:
    import RPi.GPIO as GPIO
    from mfrc522 import SimpleMFRC522



class ShelfSense:
    config: Dict[str, Any] = {}

    def __init__(self) -> None:
        self.ser_cons: Dict[str, serial.Serial] = {}
        self.unit_port_m: Dict[int, str] = {}

        configPath = os.path.abspath(os.path.join(os.path.dirname(__file__), "config.json"))

        assert os.path.exists(configPath)

        with open(configPath, "r") as f:
            self.config = json.load(f)
        
        try:
            with open("/sys/firmware/devicetree/base/model", "r") as f:
                self.isRPI = ("raspberry" in f.read().lower())
        except:
            # we must be on a non-linux then
            self.isRPI = False

        print(f"Running on a {'' if self.isRPI else 'NON-'}RPI")

        # self.unit_port_m = unit_port_m if self.isRPI else "COM8"

        self.sio = socketio.Client()

        @self.sio.event
        def connect():
            print("Connecting to SIO server")

            def authResultHandler(success: bool):
                if success:
                    print("Authentication successful")
                else:
                    print("Authentication FAILED")

                    sys.exit(-1)

            self.sio.emit("auth", data=(self.config["host"], self.config["pass"]), callback=authResultHandler)

        @self.sio.event
        def connect_error(data):
            print("Connecting to SIO server failed")

        @self.sio.event
        def put_in(order: Dict[int, int]):
            result: Tuple[bool, str] = (True, "")

            sleep(4) #TODO -add RFiD check instead of sleep!!!!

            # TODO - only if RFID cjecks out execute below code

            lastUnit: Optional[int] = None
            lastAmount: Optional[int] = None

            self.sio.emit("put_in_progress", "UNLOCKED", 0) # unlocked signal, amount can be anything, ID must be null

            try:
                for id, targetAmount in order.items():
                    print(f"Putting {targetAmount} to container {id}")
                    self.put_in(id, targetAmount)

                    if lastUnit is None:
                        lastUnit = id

                    self.attempt_shelf_open(id)

                    # TODO: read amount of items on the shelf right now

                    #self.send_to_unit(chr(0x17) + chr(id))

                    realAmount = realAmount=+1 #TODO, MOCK

                    if realAmount != lastAmount:
                        print("Progress",id,realAmount)
                        self.sio.emit("put_in_progress", id, realAmount)

                    lastAmount = realAmount

                    sleep(2)

                self.sio.emit("put_in_progress", None, lastAmount) # finished everything, amount can be anything, ID must be null
            except Exception as e:
                print("failed putting items: ", e)
                result = (False, e)

                

        @self.sio.event
        def take_out(order: List[Dict[int, int]]):
            result: Tuple[bool, str] = (True, "")
            try:
                for id, amount in order.items():
                    print(f"taking {amount} to container {id}")
                    self.take_out(id, amount)

                
                    self.attempt_shelf_open(id)
            except Exception as e:
                print("failed taking items: ", e)
                result = (False, e)

            return result  

        @self.sio.event
        def initUnits(units: List[Dict]):
            result = True
            print("Initializing units:", units)
            try:
                pass
                for unit in units:
                    if unit["serialPath"] not in self.unit_port_m.values():
                        port = unit["serialPath"]
                        connection = serial.Serial(unit["serialPath"] if isRPI else 'COM8', baudrate=115200, timeout = 1)
                        self.ser_cons[port] = connection

                        sleep(1)

                        connection.write(bytes(chr(0x00), 'latin-1'))
                        connection.timeout = 0.001
                        for _ in range(100):
                            connection.read()
                            #print(connection.read())

                        connection.write(bytes(chr(0x00), 'latin-1'))

                        connection.timeout = 1

                        connection.read()
                        connection.read()
                        connection.read()

                    self.unit_port_m[unit["id"]] = unit["serialPath"]



                    self.init_unit(unit_id=unit["id"], unit_name=unit["name"], unit_weight=unit["weight"])

                    # unit["errorMargin"] # TODO: HERE!


            except Exception as e:
                result = False
                print("Initialisation error", e)

            print(f"Initialisation result: {'' if result else 'un'}successful")

            return result

        @self.sio.event
        def disconnect():
            print("Disconnected with SIO server")

        @self.sio.event
        def calibrateContainer(containerId: int)-> bool:
            print(f"Calibration request for {containerId} received - beginning")

            result: bool = True
            try:
                self.calibrate_unit(containerId)
            except Exception as e:
                result = False
                print("Calibration error", e)

            print(f"Calibration result: {'' if result else 'un'}successful")
            
            return result
        
        self.sio.connect(f"ws://{self.config['apiHost']}:{self.config['apiPort']}")

        # if isRPI:
        #     self.rfidReader = SimpleMFRC522()

        #     self.rfidThread = Thread(target=self., args=())
        #     thread.start()
        

    def init_unit(self, unit_id: int, unit_name: str, unit_weight: int):
        data_to_send = chr(0x10)
        data_to_send+=chr(unit_id)
        data_to_send+=unit_name
        data_to_send+=chr(0x00)*(16 - len(unit_name))
        data_to_send+=chr(unit_weight)

        self.send_to_unit(data_to_send)

    def calibrate_unit(self, unit_id: int):
        self.send_to_unit(chr(0x11) + chr(unit_id))

    def take_out(self, unit_id: int, amount: int):
        self.send_to_unit(chr(0x12) + chr(unit_id) + chr(amount))

        #self.unit_opened(unit_id)

    def put_in(self, unit_id: int, amount: int):
        self.send_to_unit(chr(0x13) + chr(unit_id) + chr(amount))

        #self.unit_opened(unit_id) 

    ####### Private
    def get_connection(self, unit_id):
        return self.ser_cons[self.unit_port_m[unit_id]]

    def send_to_unit(self, data):
        connection = self.get_connection(ord(data[1]))
        connection.write(bytes(data, 'latin-1'))

        #print(bytes(data, 'latin-1'))

        cr = ord(connection.read())

        print(cr)

        if cr == 0xA2:
            while True:
                cr = ord(connection.read())
                print(cr)
                if cr == 0xAA:
                    break

        print(cr)

        if 0xAA != cr:
            raise RuntimeError("Wrong ack recieved!")

    # def debug(self, unit_id):
    #     connection = self.get_connection(unit_id)
    #     cr = ord(connection.read())
    #     while cr != 0xA2:
    #         cr = ord(connection.read())

    #     for _ in range(64):
    #         cr = ord(connection.read())
    #         print(cr)

    def attempt_shelf_open(self, unit: int):
        self.send_to_unit(chr(0x15) + chr(unit)) # unlock the container

    #LEGACY FUNCTION    
    # def unit_opened(self, unit_id):
    #     connection = self.get_connection(unit_id)
    #     while True:
    #         cr = ord(connection.read())
    #         print(cr)
    #         #RFiD Auth
    #         if 0xA0 == cr:
    #             if unit_id == ord(connection.read()):
    #                 red_RFiD = ''
    #                 for _ in range(4):
    #                     red_RFiD += hex(ord(connection.read())).upper()[2:]
    #                 print(red_RFiD)
                    
    #                 if red_RFiD == "699F0464":
    #                     self.send_to_unit(chr(0x14) + chr(unit_id) + chr(0x01))
    #                 else:
    #                     self.send_to_unit(chr(0x14) + chr(unit_id) + chr(0x00))
    #         # Unit closed
    #         elif 0xA1 == cr:
    #             if unit_id == ord(connection.read()):
    #                 break



def cleanup():
    if isRPI:
        GPIO.cleanup()

atexit.register(cleanup)

ss = ShelfSense({})

#ss.debug(1)



# ser = serial.Serial('COM8', baudrate=115200)

# sleep(1)

# ser.write(bytes(chr(0x00), 'latin-1'))
# ser.timeout = 0.001
# for _ in range(201):
#     ser.read()
#     #print(connection.read())

# ser.timeout = 1

# #ser.write(bytes(chr(0x00), 'latin-1'))


# print(ser.read())
# print(ser.read())
# print(ser.read())

# ser.write(bytes(chr(0x10) + chr(0x01) + 'A'*15 + '\0' + chr(0x10), 'latin-1'))

# for _ in range(65):
#     print(ser.read())

# ser.close()


# print(ser.read())
# print(ser.read())
# print(ser.read())
# print(ser.read())


# ser.close()

# print()

# print(chr(0x30)*2)

# ss = ShelfSense()

#ss.debug(1)

#ss.put_in(0, 1)

# ss.ser_cons['COM7'].write(bytes(chr(0x69) + chr(0x9F), 'latin-1'))

# print(ss.ser_cons['COM7'].read())

# bb = b'\xA1'

# print(hex(ord(bb)).upper()[2:])