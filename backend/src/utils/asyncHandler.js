// ============================================
// asyncHandler
// ============================================
// Envolve controllers assíncronos para encaminhar rejeições
// de Promise ao middleware de erro do Express automaticamente.

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
