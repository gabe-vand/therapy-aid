import './problems.css';

/* One problem's presence across the last few sessions: a row of 10px dots, oldest left, filled
   accent where that session wrote a note on it and hollow where it did not. The same shape Home's
   thread grid draws, so the two screens read alike. One image to a screen reader, with the count
   in words. */
export const SessionDots = ({ marks }: { marks: boolean[] }) => {
    if (marks.length === 0) return null;
    const hits = marks.filter(Boolean).length;
    return (
        <span role="img" className="ta-sdots" aria-label={`Discussed in ${hits} of the last ${marks.length} sessions`}>
            {marks.map((hit, i) => (
                <span key={i} className="ta-sdots__dot" data-hit={hit} />
            ))}
        </span>
    );
};
