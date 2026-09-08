import { useState, useCallback } from "react";

export function useRoom(initialState) {
  const [pages, setPages] = useState(initialState?.pages || [{ objects: [], background: "whiteboard" }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(initialState?.currentPageIndex || 0);
  const [question, setQuestion] = useState(initialState?.question || "");
  const [studentLocked, setStudentLocked] = useState(initialState?.studentLocked || false);
  const [background, setBackground] = useState("whiteboard");

  const loadState = useCallback((state) => {
    if (!state) return;
    const loadedPages = state.pages?.length ? state.pages : [{ objects: [], background: "whiteboard" }];
    const targetIdx = state.currentPageIndex || 0;
    setPages(loadedPages);
    setCurrentPageIndex(targetIdx);
    setQuestion(state.question || "");
    setStudentLocked(state.studentLocked || false);
    const activeBg = loadedPages[targetIdx]?.background || "whiteboard";
    setBackground(activeBg);
  }, []);

  const addPage = useCallback((newPage) => {
    setPages((prev) => [...prev, newPage]);
  }, []);

  const deletePage = useCallback((index) => {
    setPages((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updatePageBackground = useCallback((pageIndex, bg) => {
    setPages((prev) =>
      prev.map((p, i) => (i === pageIndex ? { ...p, background: bg } : p))
    );
    // Functional state inspection ensures no stale index closure
    setCurrentPageIndex((curIdx) => {
      if (pageIndex === curIdx) {
        setBackground(bg);
      }
      return curIdx;
    });
  }, []);

  const navigatePage = useCallback((index, bgOverride) => {
    setCurrentPageIndex(index);
    if (bgOverride) {
      setBackground(bgOverride);
    } else {
      setPages((prevPages) => {
        setBackground(prevPages[index]?.background || "whiteboard");
        return prevPages;
      });
    }
  }, []);

  return {
    pages, setPages,
    currentPageIndex, setCurrentPageIndex,
    question, setQuestion,
    studentLocked, setStudentLocked,
    background, setBackground,
    loadState,
    addPage,
    deletePage,
    updatePageBackground,
    navigatePage,
  };
}