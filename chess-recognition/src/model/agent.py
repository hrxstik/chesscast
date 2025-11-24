from model.virtual_board import VirtualBoard
from typing import Optional
import numpy as np
import chess

class Agent:
  """
  Smart chess agent
  """
  board: VirtualBoard = None

  __current_board_state: np.array = None
  __indexes = sorted(np.arange(1, 9), reverse=True)
  __columns = list("abcdefgh")

  ___initial_board_state = np.array([
    [7, 11, 8, 10, 9, 8, 11, 7],
    [6, 6, 6, 6, 6, 6, 6, 6],
    [-1,-1,-1,-1,-1,-1,-1,-1],
    [-1,-1,-1,-1,-1,-1,-1,-1],
    [-1,-1,-1,-1,-1,-1,-1,-1],
    [-1,-1,-1,-1,-1,-1,-1,-1],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 3, 2, 5, 4, 2, 3, 1]
  ])

  def __init__(self):
    self.__current_board_state = self.___initial_board_state
    self.board = VirtualBoard()


  def updateState(self, board_state):
    self.__current_board_state = board_state

  def state2Move(self, board_state: np.array) -> Optional[chess.Move]:
        coordinates = []
        result = np.abs(self.__current_board_state - board_state)

        for ridx, row in enumerate(result):
            for cidx, col in enumerate(row):
                if col > 0:
                    coordinates.append(f'{self.__columns[cidx]}{self.__indexes[ridx]}')

        if len(coordinates) > 0:
            moviments = []
            for coord_i in coordinates:
                for coord_j in coordinates:
                    if coord_i != coord_j:
                        moviments.append(coord_i + coord_j)

            for uci_str in moviments:
                move = chess.Move.from_uci(uci_str)
                if move in self.board.legal_moves:
                    return move
        return None