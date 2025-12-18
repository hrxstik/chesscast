import React from 'react';

interface MoveItem {
  san: string; // SAN-нотация (e4, Nf3, ...)
  uci: string; // UCI-нотация (e2e4, g1f3, ...)
}

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
    <div className="text-sm max-h-64 overflow-y-auto border rounded-md p-2 bg-background">
      <table className="w-full text-left text-xs sm:text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.moveNumber} className="border-b last:border-b-0">
              <td className="pr-2 align-top text-muted-foreground">{row.moveNumber}.</td>
              <td className="pr-4 align-top">
                {row.white ? (
                  <span title={row.white.uci}>{row.white.san}</span>
                ) : (
                  <span className="text-muted-foreground">...</span>
                )}
              </td>
              <td className="align-top">
                {row.black ? <span title={row.black.uci}>{row.black.san}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
