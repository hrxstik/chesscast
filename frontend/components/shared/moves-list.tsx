import React from 'react';

export type MoveItem = { san: string };

interface MovesListProps {
  moves: MoveItem[];
}

export const MovesList: React.FC<MovesListProps> = ({ moves }) => {
  if (!moves.length) {
    return <div className="text-sm text-muted-foreground">Ходы пока не обнаружены.</div>;
  }

  const rows: { moveNumber: number; white?: MoveItem; black?: MoveItem }[] = [];

  moves.forEach((move, index) => {
    const moveNumber = Math.floor(index / 2) + 1;
    const isWhite = index % 2 === 0;

    if (isWhite) {
      rows.push({ moveNumber, white: move });
    } else {
      const row = rows[rows.length - 1];
      if (row && row.moveNumber === moveNumber) {
        row.black = move;
      } else {
        rows.push({ moveNumber, black: move });
      }
    }
  });

  return (
    <div className="text-sm border rounded-md p-2 bg-background">
      <table className="w-full text-left text-xs md:text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.moveNumber} className="border-b last:border-b-0">
              <td className="pr-2 align-top text-muted-foreground">{row.moveNumber}.</td>
              <td className="pr-4 align-top">{row.white?.san ?? '…'}</td>
              <td className="align-top">{row.black?.san ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
