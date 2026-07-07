-- 1. Create function to recalculate case counts for departments
CREATE OR REPLACE FUNCTION sync_department_case_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate old department counts on update/delete
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.department_id IS NOT NULL THEN
        UPDATE departments
        SET active_cases = (SELECT COUNT(*) FROM cases WHERE department_id = OLD.department_id AND status != 'Resolved'),
            total_cases = (SELECT COUNT(*) FROM cases WHERE department_id = OLD.department_id)
        WHERE id = OLD.department_id;
    END IF;

    -- Recalculate new department counts on insert/update
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.department_id IS NOT NULL THEN
        UPDATE departments
        SET active_cases = (SELECT COUNT(*) FROM cases WHERE department_id = NEW.department_id AND status != 'Resolved'),
            total_cases = (SELECT COUNT(*) FROM cases WHERE department_id = NEW.department_id)
        WHERE id = NEW.department_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind the trigger to cases table
DROP TRIGGER IF EXISTS trg_sync_department_case_counts ON cases;

CREATE TRIGGER trg_sync_department_case_counts
AFTER INSERT OR UPDATE OR DELETE ON cases
FOR EACH ROW
EXECUTE FUNCTION sync_department_case_counts();
