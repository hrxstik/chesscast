from typing import Dict, Tuple
from model.chessboard_calibration import ChessboardCalibration
from model.board import Board
from model.agent import Agent
from model.camera import Camera
from dotenv import dotenv_values

import cv2
import numpy as np
import time
import imutils

class Game():
  __cam_address: str
  __running_calibration: ChessboardCalibration
  __board: Board
  __config: Dict
  __agent: Agent
  __camera: Camera = None
  # __fps: float
  # __lastupdate: float
  # __detections: list = None
  __hand_present: bool

  def __init__(self, **kwargs):
    self.__hand_present = False 
    self.__config = dotenv_values()
    self.__cam_address = self.__config.get('CAM_ADDRESS')
    self.__agent = Agent()
    self.__debug = bool(int(self.__config.get('DEBUG')))

    # frame rate metrics
    # self.__fps = 0.
    # self.__lastupdate = time.time()

  def mapping(self):
    """
    Start mapping chess board
    """
    camera = Camera(self.__cam_address)
    frame = camera.capture()

    # do calibration mapping
    chessboard_calibration = ChessboardCalibration(debug=self.__debug)
    chessboard_calibration.mapping(
      chessboard_img=frame,
      fix_rotate=True,
      rotate_val=90,
      add_padding=True
    )
    chessboard_calibration.saveMapping()
    
    # release camera
    camera.destroy()
    print('Done!')

  def start(self):
    """
    Start game
    """
    self.__camera = Camera(self.__cam_address)

    self.__running_calibration = ChessboardCalibration()
    found, self.__board = self.__running_calibration.loadMapping()
    if not found:
      raise Exception('No mapping found. Run calibration mapping')

    # self.__captureFrame()
    # self.__runScan(only_prediction=True)

    # Start capturing frames
    while True:
      self.__captureFrame()
      self.__runScan(only_prediction=True)
      time.sleep(0.25)  # ~4 FPS limit

  def __captureFrame(self):
      frame = self.__camera.capture()
      self.__processed_image = self.__running_calibration.applyMapping(frame)

      _, hand_is_detected = self.__hand_detected(self.__processed_image)
      self.__hand_present = hand_is_detected
      # self.__updateFrameRate()
    
  def __hand_detected(self, no_houses_frame, white_pieces_mask, black_pieces_mask) -> Tuple[bool, list]:
    """
    return `True` or `False` if hand is detected
    """
    white_pieces_mask = 255-white_pieces_mask
    black_pieces_mask = 255-black_pieces_mask

    no_houses_frame = cv2.bitwise_and(no_houses_frame, no_houses_frame, mask=white_pieces_mask)
    no_houses_frame = cv2.bitwise_and(no_houses_frame, no_houses_frame, mask=black_pieces_mask)

    # convert image to gray scale
    gray = cv2.cvtColor(no_houses_frame, cv2.COLOR_BGR2GRAY)

    # This is the threshold level for every pixel.
    thresh = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)[1]
    thresh = cv2.erode(thresh, None, iterations=8)

    cnts = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = imutils.grab_contours(cnts)

    if cnts is not None and len(cnts) > 0:
      cnt = max(cnts, key=cv2.contourArea)
      return (True, cnt)
    else:
      return (False, None)

  def __runScan(self):
    if self.__hand_present:
      return None
    
    squares, self.__detections = self.__board.scan(self.__processed_image)
    board_state = self.__board.toMatrix(squares)
    
    move = self.__agent.state2Move(board_state)
    self.__agent.updateState(board_state)
    if move is not None:
        print('Detected move:', move.uci())
        return move
    else:
        return None
    
  def close(self):
    if self.__camera:
        self.__camera.destroy()