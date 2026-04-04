import { type Component } from "solid-js";
import ModalCommon from "../../common/UI/ModalCommon";


interface ModCUProdProps {
    onClose: () => void;

}

export const ModCUProd: Component<ModCUProdProps> = (props) => {

    return (
        <ModalCommon onClose={props.onClose} width="460px">
            <>
                Modal</>
        </ModalCommon>
    );
};