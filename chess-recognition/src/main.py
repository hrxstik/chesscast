import sys
from argparse import ArgumentParser, BooleanOptionalAction
from model import Game

# define arguments
parser = ArgumentParser()
parser.add_argument("-m", "--mapping",
                    action=BooleanOptionalAction,
                    default=False,
                    help="Starts the mapping of the board")

parser.add_argument("-s", "--start",
                    action=BooleanOptionalAction,
                    default=False,
                    help="Chess game starts")

parser.add_argument("-x", "--stop",
                    action=BooleanOptionalAction,
                    default=False,
                    help="Stop the game and clean up resources")

args = vars(parser.parse_args())

if __name__ == "__main__":
  # calibration mapping
  if args['mapping']:
    game = Game()
    game.mapping()

  # start a game
  if args['start']:
    game = Game()
    game.start()
    sys.exit(app.exec_())

  if args['stop']:
    game = Game()
    game.close()
    sys.exit()