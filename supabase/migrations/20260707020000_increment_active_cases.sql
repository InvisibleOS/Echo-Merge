CREATE OR REPLACE FUNCTION increment_active_cases(p_dept_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE departments 
    SET active_cases = active_cases + 1,
        total_cases = total_cases + 1
    WHERE id = p_dept_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
